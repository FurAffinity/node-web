'use strict';

const ApplicationError = require('./errors').ApplicationError;

class MissingPermissionError extends ApplicationError {
	constructor(permission) {
		super('Missing permission: ' + permission.name);
	}
}

ApplicationError.extendClass(MissingPermissionError);

class Permission {
	constructor(name, has) {
		if (typeof has !== 'function') {
			throw new TypeError('has should be a function');
		}

		this.name = name;
		this.has = has;
	}

	get middleware() {
		return (request, response, next) => {
			this.has(request, (error, hasPermission) => {
				if (error) {
					next(error);
					return;
				}

				if (hasPermission) {
					next(null);
				} else {
					next(new MissingPermissionError(this));
				}
			});
		};
	}
}

exports.MissingPermissionError = MissingPermissionError;
exports.Permission = Permission;

exports.user = new Permission('user', (request, callback) => {
	process.nextTick(callback, null, request.user !== null);
});

exports.submit = new Permission('submit', (request, callback) => {
	process.nextTick(callback, null, request.user !== null);
});
