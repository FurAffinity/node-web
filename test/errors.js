/* eslint new-cap: 0 */
'use strict';

const tap = require('tap');

const errors = require('../app/errors');
const ApplicationError = errors.ApplicationError;

tap.test('ApplicationError should behave in a manner consistent with other errors', t => {
	const testConstructor = errorConstructor => {
		t.deepEqual(
			Object.getOwnPropertyDescriptor(errorConstructor.prototype, 'message'),
			{
				value: '',
				writable: true,
				enumerable: false,
				configurable: true,
			}
		);

		const instance = new errorConstructor('test error');

		t.deepEqual(
			Object.getOwnPropertyDescriptor(instance, 'message'),
			{
				value: 'test error',
				writable: true,
				enumerable: false,
				configurable: true,
			}
		);

		t.ok(instance instanceof errorConstructor, 'instance is an instance of ' + errorConstructor.name);
		t.ok(instance instanceof Error, 'instance is an instance of Error');
		t.equal(instance.toString(), errorConstructor.name + ': test error', 'instance’s toString() includes its message');
		t.equal(instance.constructor, errorConstructor, 'instance’s constructor is ' + errorConstructor.name);
		t.ok(new RegExp(errorConstructor.name + ': test error\\s*at .*test\\/errors\\.js').test(instance.stack));
		t.ok(!instance.hasOwnProperty('name'));

		t.ok(!new errorConstructor().hasOwnProperty('message'));
	};

	class TestError extends ApplicationError {}

	ApplicationError.extendClass(TestError);

	class TestDerivedError extends TestError {}

	TestError.extendClass(TestDerivedError);

	testConstructor(RangeError);
	testConstructor(ApplicationError);
	testConstructor(TestError);
	testConstructor(TestDerivedError);

	t.ok(new TestError() instanceof ApplicationError);
	t.ok(new TestDerivedError() instanceof ApplicationError);
	t.ok(new TestDerivedError() instanceof TestError);

	t.end();
});
