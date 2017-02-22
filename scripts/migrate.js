/* eslint global-require: 0 */
'use strict';

const bluebird = require('bluebird');
const fs = require('fs');
const path = require('path');

const config = require('../app/config');

const Pool = require('../app/database').Pool;

const database = new Pool(config.database);

const MIGRATION_ROOT = path.join(__dirname, '../migrations');
const MIGRATION_ORDER = path.join(MIGRATION_ROOT, 'order');

const isOrderLine = line =>
	line !== '' && !line.startsWith('#');

const getVersion = result =>
	result.rows.length === 1 ? result.rows[0].version : null;

const getMigration = (migrationName, direction) => {
	let migration = null;
	const jsMigrationPath = path.join(MIGRATION_ROOT, migrationName + '.js');

	try {
		migration = require(jsMigrationPath);
	} catch (error) {
		if (error.code !== 'MODULE_NOT_FOUND') {
			throw error;
		}
	}

	if (migration) {
		return migration[direction];
	}

	const sqlMigrationPath = path.join(MIGRATION_ROOT, migrationName, direction + '.sql');
	const sql = fs.readFileSync(sqlMigrationPath, 'utf8');

	return client =>
		client.query(sql);
};

const migrate = async (client, targetVersion) => {
	const migrationOrder =
		fs.readFileSync(MIGRATION_ORDER, 'utf8')
			.split('\n')
			.filter(isOrderLine);

	await client.query('CREATE TABLE IF NOT EXISTS database_version (version TEXT NOT NULL)');

	const currentVersion = getVersion(await client.query('SELECT version FROM database_version'));
	const currentIndex = migrationOrder.indexOf(currentVersion);
	const targetIndex =
		targetVersion === null ?
			migrationOrder.length - 1 :
			migrationOrder.indexOf(targetVersion);

	if (currentVersion !== null && currentIndex === -1) {
		throw new Error('Current version not found: ' + currentVersion);
	}

	if (targetVersion !== null && targetIndex === -1) {
		throw new Error('Target version not found: ' + targetVersion);
	}

	if (currentIndex === targetIndex) {
		console.log('Database is already at version ' + currentVersion + '.');
		return;
	}

	console.log(currentVersion || '(no version)');

	if (targetIndex < currentIndex) {
		for (let i = currentIndex; i > targetIndex; i--) {
			const migrationName = migrationOrder[i];
			const migration = getMigration(migrationName, 'down');

			console.log('↘ ' + migrationOrder[i - 1]);
			await migration(client);
		}
	} else {
		for (let i = currentIndex + 1; i <= targetIndex; i++) {
			const migrationName = migrationOrder[i];
			const migration = getMigration(migrationName, 'up');

			console.log('↗ ' + migrationName);
			await migration(client);
		}
	}

	const newVersion = migrationOrder[targetIndex];

	if (currentVersion) {
		await client.query('UPDATE database_version SET version = $1', [newVersion]);
	} else if (newVersion) {
		await client.query('INSERT INTO database_version (version) VALUES ($1)', [newVersion]);
	}
};

bluebird.longStackTraces();

const targetVersion =
	process.argv.length >= 3 ?
		process.argv[2] :
		null;

database.withTransaction(
	client =>
		migrate(client, targetVersion)
)
	.finally(() => {
		database.end();
	})
	.done();
