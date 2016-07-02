/* eslint global-require: 0 */
"use strict";

var bluebird = require("bluebird");
var fs = require("fs");
var path = require("path");

var database = require("../app/database");

var MIGRATION_ROOT = path.join(__dirname, "../migrations");
var MIGRATION_ORDER = path.join(MIGRATION_ROOT, "order");

function isOrderLine(line) {
	return line !== "" && !line.startsWith("#");
}

function getVersion(result) {
	return result.rows.length === 1 ? result.rows[0].version : null;
}

function getMigration(migrationName, direction) {
	var migration = null;
	var jsMigrationPath = path.join(MIGRATION_ROOT, migrationName + ".js");

	try {
		migration = require(jsMigrationPath);
	} catch (error) {
		if (error.code !== "MODULE_NOT_FOUND") {
			throw error;
		}
	}

	if (migration) {
		return migration[direction];
	}

	var sqlMigrationPath = path.join(MIGRATION_ROOT, migrationName, direction + ".sql");
	var sql = fs.readFileSync(sqlMigrationPath, "utf8");

	return function* (client) {
		yield client.query(sql);
	};
}

function* migrate(client, targetVersion) {
	var migrationOrder =
		fs.readFileSync(MIGRATION_ORDER, "utf8")
			.split("\n")
			.filter(isOrderLine);

	yield client.query("CREATE TABLE IF NOT EXISTS database_version (version TEXT NOT NULL)");

	var currentVersion = getVersion(yield client.query("SELECT version FROM database_version"));
	var currentIndex = migrationOrder.indexOf(currentVersion);
	var targetIndex =
		targetVersion === null ?
			migrationOrder.length - 1 :
			migrationOrder.indexOf(targetVersion);

	if (currentVersion !== null && currentIndex === -1) {
		throw new Error("Current version not found: " + currentVersion);
	}

	if (targetVersion !== null && targetIndex === -1) {
		throw new Error("Target version not found: " + targetVersion);
	}

	if (currentIndex === targetIndex) {
		console.log("Database is already at version " + currentVersion + ".");
		return;
	}

	console.log(currentVersion || "(no version)");

	if (targetIndex < currentIndex) {
		for (let i = currentIndex; i > targetIndex; i--) {
			const migrationName = migrationOrder[i];
			const migration = getMigration(migrationName, "down");

			console.log("↘ " + migrationOrder[i - 1]);
			yield* migration(client);
		}
	} else {
		for (let i = currentIndex + 1; i <= targetIndex; i++) {
			const migrationName = migrationOrder[i];
			const migration = getMigration(migrationName, "up");

			console.log("↗ " + migrationName);
			yield* migration(client);
		}
	}

	var newVersion = migrationOrder[targetIndex];

	if (currentVersion) {
		yield client.query("UPDATE database_version SET version = $1", [newVersion]);
	} else if (newVersion) {
		yield client.query("INSERT INTO database_version (version) VALUES ($1)", [newVersion]);
	}
}

bluebird.longStackTraces();

var targetVersion =
	process.argv.length >= 3 ?
		process.argv[2] :
		null;

database.withTransaction(
	function (client) {
		return bluebird.coroutine(migrate)(client, targetVersion);
	}
)
	.finally(function () {
		database.end();
	})
	.done();
