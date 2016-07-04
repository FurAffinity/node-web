"use strict";

var tap = require("tap");

var database = require("../app/database");
var postgresql = require("../app/postgresql");

tap.tearDown(function () {
	return database.end();
});

tap.test("serializeByteaArray", function (t) {
	var a = Buffer.alloc(8);
	a.writeDoubleLE(Math.PI, 0);

	var b = Buffer.alloc(8);
	b.writeDoubleBE(Math.E, 0);

	return database.query(
		"SELECT ($1::bytea[])[1] || ($1::bytea[])[2] AS concatenation",
		[postgresql.serializeByteaArray([a, b])]
	).then(function (result) {
		t.equal(
			result.rows[0].concatenation.toString("hex"),
			"182d4454fb2109404005bf0a8b145769"
		);
	});
});
