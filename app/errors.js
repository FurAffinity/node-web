"use strict";

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

ApplicationError.extend = function extend(constructor) {
	constructor.prototype = Object.create(ApplicationError.prototype, {
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
};

exports.ApplicationError = ApplicationError;
