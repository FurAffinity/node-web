'use strict';

var ApplicationError = require('./errors').ApplicationError;

function httpError(name, httpStatus, defaultMessage) {
	function constructor(message) {
		ApplicationError.call(this, message);
	}

	Object.defineProperty(constructor, 'name', {
		configurable: true,
		value: name,
	});

	ApplicationError.extend(constructor);

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
}

exports.NotAcceptableError = httpError('NotAcceptableError', 406, 'No acceptable media type');
exports.TooManyRequestsError = httpError('TooManyRequestsError', 429, 'Too many requests');
