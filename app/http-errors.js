'use strict';

const ApplicationError = require('./errors').ApplicationError;

const httpError = (name, httpStatus, defaultMessage) => {
	class constructor extends ApplicationError {}

	Object.defineProperty(constructor, 'name', {
		configurable: true,
		value: name,
	});

	ApplicationError.extendClass(constructor);

	Object.defineProperty(constructor.prototype, 'message', {
		configurable: true,
		writable: true,
		value: defaultMessage,
	});

	Object.defineProperty(constructor.prototype, 'httpStatus', {
		configurable: true,
		writable: true,
		value: httpStatus,
	});

	return constructor;
};

exports.NotAcceptableError = httpError('NotAcceptableError', 406, 'No acceptable media type');
exports.TooManyRequestsError = httpError('TooManyRequestsError', 429, 'Too many requests');
