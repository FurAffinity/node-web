'use strict';

var ApplicationError = require('./errors').ApplicationError;

function MissingPermissionError(permission) {
	ApplicationError.call(this, 'Missing permission: ' + permission.name);
}

ApplicationError.extend(MissingPermissionError);

function Permission(name, has) {
	if (typeof has !== 'function') {
		throw new TypeError('has should be a function');
	}

	this.name = name;
	this.has = has;
}

Object.defineProperty(Permission.prototype, 'middleware', {
	get: function () {
		var permission = this;

		return function permissionMiddleware(request, response, next) {
			permission.has(request, function (error, hasPermission) {
				if (error) {
					next(error);
					return;
				}

				if (hasPermission) {
					next();
				} else {
					next(new MissingPermissionError(permission));
				}
			});
		};
	},
});

exports.MissingPermissionError = MissingPermissionError;
exports.Permission = Permission;

exports.user = new Permission('user', function (request, callback) {
	process.nextTick(function () {
		callback(null, request.user !== null);
	});
});

exports.submit = new Permission('submit', function (request, callback) {
	process.nextTick(function () {
		callback(null, request.user !== null);
	});
});
