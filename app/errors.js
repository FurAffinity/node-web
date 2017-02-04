'use strict';

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
		message: {
			configurable: true,
			enumerable: false,
			writable: true,
			value: '',
		},
	});

	constructor.extend = extend;
}

function ApplicationError(message) {
	if (message !== undefined) {
		Object.defineProperty(this, 'message', {
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
		writable: true,
		value: ApplicationError,
	},
	name: {
		configurable: true,
		writable: true,
		value: ApplicationError.name,
	},
	message: {
		configurable: true,
		writable: true,
		value: '',
	},
	httpStatus: {
		configurable: true,
		writable: true,
		value: 500,
	},
});

ApplicationError.extend = extend;

exports.ApplicationError = ApplicationError;
