"use strict";

var bluebird = require("bluebird");
var pg = require("pg");

var config = require("./config");

pg.Client.prototype.queryAsync = (function () {
	var queryAsync_ = bluebird.promisify(pg.Client.prototype.query);

	return function (query) {
		var start = process.hrtime();

		return queryAsync_.call(this, query).tap(function () {
			var t = process.hrtime(start);
			console.log(query.name + ": " + (t[0] * 1000 + t[1] * 1e-6 | 0) + " ms");
		});
	};
})();

function connect() {
	var done_ = null;

	return new bluebird.Promise(function (resolve, reject) {
		pg.connect(config.database, function (error, client, done) {
			if (error) {
				reject(error);
				return;
			}

			done_ = done;
			resolve(client);
		});
	}).disposer(function () {
		if (done_) {
			done_();
		}
	});
}

function queryAsync(query) {
	return bluebird.using(connect(), function (client) {
		return client.queryAsync(query);
	});
}

function withTransaction(useTransaction) {
	return bluebird.using(connect(), function (client) {
		return client.queryAsync("BEGIN").then(function () {
			return useTransaction(client)
				.tap(function () {
					return client.queryAsync("COMMIT");
				})
				.catch(function (error) {
					function throwOriginal() {
						return bluebird.reject(error);
					}

					return client.queryAsync("ROLLBACK")
						.then(throwOriginal, throwOriginal);
				});
		});
	});
}

exports.queryAsync = queryAsync;
exports.withTransaction = withTransaction;
