'use strict';

class ApplicationError extends Error {
	constructor(message) {
		super(message);

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

	static extendClass(constructor) {
		if (!(constructor.prototype instanceof this) && constructor !== this) {
			throw new TypeError('constructor must extend class when used with extendClass');
		}

		Object.defineProperties(constructor.prototype, {
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
	}
}

ApplicationError.extendClass(ApplicationError);

Object.defineProperty(ApplicationError.prototype, 'httpStatus', {
	configurable: true,
	writable: true,
	value: 500,
});

exports.ApplicationError = ApplicationError;
