'use strict';

var bluebird = require('bluebird');
var pg = require('pg');

var config = require('../config');

function ClientWrapper(client) {
	this.client = client;
}

ClientWrapper.prototype.query = function (options, values) {
	var promise = this.client.query(options, values).promise();
	return bluebird.resolve(promise);
};

var pool = new pg.Pool(
	Object.assign(
		{ Promise: bluebird },
		config.database
	)
);

pool.on('error', function (error) {
	console.error('idle client error: ' + error.stack);
});

pool.connectDisposer = function () {
	return this.connect().disposer(function (client) {
		client.release();
	});
};

pool.withTransaction = function (useTransaction) {
	return bluebird.using(this.connectDisposer(), function (client) {
		return client.query('BEGIN').then(function () {
			return useTransaction(new ClientWrapper(client))
				.tap(function () {
					return client.query('COMMIT');
				})
				.catch(function (error) {
					function throwOriginal() {
						return bluebird.reject(error);
					}

					return client.query('ROLLBACK')
						.then(throwOriginal, throwOriginal);
				});
		});
	});
};

module.exports = pool;
