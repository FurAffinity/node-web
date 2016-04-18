/* eslint global-require: 0 */
"use strict";

var bluebird = require("bluebird");
var fs = require("fs");
var path = require("path");
var pg = require("pg");

var database = require("../app/database");
var readFileAsync = bluebird.promisify(fs.readFile);

var MIGRATION_ROOT = path.join(__dirname, "../migrations");
var MIGRATION_ORDER = path.join(MIGRATION_ROOT, "order");

function isOrderLine(line) {
	return line !== "" && !line.startsWith("#");
}

function getVersion(result) {
	return result.rows.length === 1 ? result.rows[0].version : null;
}

function* getSQLMigration(migrationName) {
	var contents = yield readFileAsync(path.join(MIGRATION_ROOT, migrationName, "up.sql"), "utf8");

	return {
		up: function* (queryAsync) {
			yield queryAsync(contents);
		},
	};
}

function* runMigration(queryAsync, migrationName) {
	var migration;

	try {
		migration = require(path.join(MIGRATION_ROOT, migrationName + ".js"));
	} catch (error) {
		migration = yield* getSQLMigration(migrationName);
	}

	yield* migration.up(queryAsync);
}

function* migrate(client) {
	var queryAsync = bluebird.promisify(client.query, { context: client });

	var migrationOrder =
		(yield readFileAsync(MIGRATION_ORDER, "utf8"))
			.split("\n")
			.filter(isOrderLine);

	yield queryAsync("CREATE TABLE IF NOT EXISTS database_version (version TEXT NOT NULL)");

	var currentVersion = getVersion(yield queryAsync("SELECT version FROM database_version"));
	var versionIndex = migrationOrder.indexOf(currentVersion);

	if (currentVersion !== null && versionIndex === -1) {
		throw new Error("Version not found: " + currentVersion);
	}

	var lastMigration = currentVersion;

	for (var i = versionIndex + 1; i < migrationOrder.length; i++) {
		var migrationName = migrationOrder[i];

		console.log(`${lastMigration || "(empty database)"} → ${migrationName}`);

		yield* runMigration(queryAsync, migrationName);

		lastMigration = migrationName;
	}

	if (currentVersion !== null) {
		yield queryAsync("UPDATE database_version SET version = $1", [lastMigration]);
	} else if (lastMigration !== null) {
		yield queryAsync("INSERT INTO database_version (version) VALUES ($1)", [lastMigration]);
	}
}

bluebird.longStackTraces();

database.withTransaction(
	function (client) {
		return bluebird.coroutine(migrate)(client);
	}
)
	.finally(function () {
		pg.end();
	})
	.done();
