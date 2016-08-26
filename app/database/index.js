'use strict';

var Promise = require('bluebird');
var pg = require('pg');

function ClientWrapper(client) {
	this.client = client;
}

ClientWrapper.prototype.query = function (options, values) {
	var promise = this.client.query(options, values).promise();
	return Promise.resolve(promise);
};

function Pool(options) {
	options = Object.assign({ Promise: Promise }, options);
	pg.Pool.call(this, options);
}

Pool.prototype = Object.create(pg.Pool.prototype, {
	constructor: {
		configurable: true,
		writable: true,
		value: Pool,
	},
	connectDisposer: {
		configurable: true,
		writable: true,
		value: function () {
			return this.connect().disposer(function (client) {
				client.release();
			});
		},
	},
	withTransaction: {
		configurable: true,
		writable: true,
		value: function (useTransaction) {
			return Promise.using(this.connectDisposer(), function (client) {
				return client.query('BEGIN').then(function () {
					return useTransaction(new ClientWrapper(client))
						.tap(function () {
							return client.query('COMMIT');
						})
						.catch(function (error) {
							function throwOriginal() {
								return Promise.reject(error);
							}

							return client.query('ROLLBACK')
								.then(throwOriginal, throwOriginal);
						});
				});
			});
		},
	},
});

exports.Pool = Pool;
