'use strict';

const bluebird = require('bluebird');
const tap = require('tap');

const config = require('../app/config');
const postgresql = require('../app/database/postgresql');

const Pool = require('../app/database').Pool;

const database = new Pool(config.database);

tap.tearDown(function () {
	return database.end();
});

tap.test('serializeByteaArray', function (t) {
	const left = Buffer.alloc(8);
	left.writeDoubleLE(Math.PI, 0);

	const right = Buffer.alloc(8);
	right.writeDoubleBE(Math.E, 0);

	return bluebird.all([
		database.query(
			'SELECT ($1::bytea[])[1] || ($1::bytea[])[2] AS concatenation',
			[postgresql.serializeByteaArray([left, right])]
		),
		database.query(
			'SELECT ($1::bytea[])[1] || ($1::bytea[])[2] AS concatenation',
			[postgresql.serializeByteaArray([left, null])]
		),
	]).spread(function (a, b) {
		t.equal(
			a.rows[0].concatenation.toString('hex'),
			'182d4454fb2109404005bf0a8b145769'
		);

		t.equal(
			b.rows[0].concatenation,
			null
		);
	});
});
