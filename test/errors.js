/* eslint new-cap: 0 */
"use strict";

var tap = require("tap");

var errors = require("../app/errors");
var ApplicationError = errors.ApplicationError;

tap.test("ApplicationError should behave in a manner consistent with other errors", function (t) {
	function testConstructor(errorConstructor) {
		t.deepEqual(
			Object.getOwnPropertyDescriptor(errorConstructor.prototype, "message"),
			{
				value: "",
				writable: true,
				enumerable: false,
				configurable: true,
			}
		);

		var instance = new errorConstructor("test error");

		t.deepEqual(
			Object.getOwnPropertyDescriptor(instance, "message"),
			{
				value: "test error",
				writable: true,
				enumerable: false,
				configurable: true,
			}
		);

		t.ok(instance instanceof errorConstructor);
		t.ok(instance instanceof Error);
		t.equal(instance.toString(), errorConstructor.name + ": test error");
		t.equal(instance.constructor, errorConstructor);
		t.ok(new RegExp(errorConstructor.name + ": test error\\s*at .*test\\/errors\\.js").test(instance.stack));
		t.ok(!instance.hasOwnProperty("name"));

		t.ok(!new errorConstructor().hasOwnProperty("message"));
	}

	function TestError(message) {
		ApplicationError.call(this, message);
	}

	ApplicationError.extend(TestError);

	function TestDerivedError(message) {
		TestError.call(this, message);
	}

	TestError.extend(TestDerivedError);

	testConstructor(RangeError);
	testConstructor(ApplicationError);
	testConstructor(TestError);
	testConstructor(TestDerivedError);

	t.ok(new TestError() instanceof ApplicationError);
	t.ok(new TestDerivedError() instanceof ApplicationError);
	t.ok(new TestDerivedError() instanceof TestError);

	t.end();
});
