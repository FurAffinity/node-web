'use strict';

var bluebird = require('bluebird');
var tap = require('tap');

var database = require('../app/database');
var postgresql = require('../app/postgresql');

tap.tearDown(function () {
	return database.end();
});

tap.test('serializeByteaArray', function (t) {
	var left = Buffer.alloc(8);
	left.writeDoubleLE(Math.PI, 0);

	var right = Buffer.alloc(8);
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
