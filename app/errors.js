"use strict";

function extend(constructor) {
	constructor.prototype = Object.create(this.prototype, {
		constructor: {
			configurable: true,
			enumerable: false,
			writable: true,
			value: constructor,
		},
		name: {
			configurable: true,
			enumerable: false,
			writable: true,
			value: constructor.name,
		},
	});

	constructor.extend = extend;
}

function ApplicationError(message) {
	if (message !== undefined) {
		Object.defineProperty(this, "message", {
			configurable: true,
			enumerable: false,
			writable: true,
			value: String(message),
		});
	}

	Error.captureStackTrace(this, this.constructor);
}

ApplicationError.prototype = Object.create(Error.prototype, {
	constructor: {
		configurable: true,
		enumerable: false,
		writable: true,
		value: ApplicationError,
	},
	name: {
		configurable: true,
		enumerable: false,
		writable: true,
		value: ApplicationError.name,
	},
});

ApplicationError.extend = extend;

exports.ApplicationError = ApplicationError;
