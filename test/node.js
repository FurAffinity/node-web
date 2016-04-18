"use strict";

var tap = require("tap");

tap.test("String.prototype.normalize should work properly", function (t) {
	t.equal("é".normalize("NFD"), "e\u0301");
	t.end();
});
