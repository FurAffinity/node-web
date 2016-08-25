'use strict';

var Promise = require('bluebird');
var crypto = require('crypto');

var timingSafeCompare = require('./timing-safe-compare').timingSafeCompare;

var SESSION_ID_SIZE = 18;
var SESSION_KEY_SIZE = 18;

var GUEST_COOKIE_SIZE = SESSION_ID_SIZE;
var USER_COOKIE_SIZE = SESSION_ID_SIZE + SESSION_KEY_SIZE;

function hashKey(key) {
	return crypto.createHash('sha256')
		.update(key)
		.digest();
}

function getCreateSessionQuery(id, keyHash, userId) {
	return {
		name: 'create_session',
		text: 'INSERT INTO sessions (id, key_hash, "user") VALUES ($1, $2, $3)',
		values: [id, keyHash, userId],
	};
}

function getSelectSessionQuery(id, sessionLifetime) {
	return {
		name: 'select_session',
		text: `SELECT key_hash, "user" FROM sessions WHERE id = $1 AND created >= NOW() - $2 * INTERVAL '1 second'`,
		values: [id, sessionLifetime],
	};
}

function getDeleteSessionQuery(id) {
	return {
		name: 'delete_session',
		text: 'DELETE FROM sessions WHERE id = $1',
		values: [id],
	};
}

function GuestSession(sessionId) {
	this.sessionId = sessionId;
}

Object.defineProperty(GuestSession.prototype, 'userId', {
	configurable: true,
	value: null,
});

GuestSession.prototype.getCookie = function () {
	return this.sessionId.toString('base64');
};

function UserSession(sessionId, sessionKey, userId) {
	if (!Number.isSafeInteger(userId) || userId <= 0) {
		throw new TypeError('User id should be a positive integer');
	}

	this.sessionId = sessionId;
	this.sessionKey = sessionKey;
	this.userId = userId;
}

UserSession.prototype.getCookie = function () {
	return Buffer.concat([this.sessionId, this.sessionKey]).toString('base64');
};

function SessionStorage(options) {
	var cookieName = options.cookieName;
	var cookieSecure = options.cookieSecure;
	var userSessionLifetime = options.userSessionLifetime;

	if (typeof cookieName !== 'string') {
		throw new TypeError('Cookie name should be a string');
	}

	if (typeof cookieSecure !== 'boolean') {
		throw new TypeError('Cookie Secure flag should be a boolean');
	}

	if (!Number.isSafeInteger(userSessionLifetime) || userSessionLifetime <= 0) {
		throw new TypeError('User session lifetime should be a positive integer');
	}

	this.cookieName = cookieName;
	this.cookieSecure = cookieSecure;
	this.userSessionLifetime = userSessionLifetime;
}

SessionStorage.prototype.readSession = function (request) {
	var sessionCookie = request.cookies.get(this.cookieName);

	if (!sessionCookie) {
		return Promise.resolve(null);
	}

	var cookieBytes = Buffer.from(sessionCookie, 'base64');

	if (cookieBytes.length === GUEST_COOKIE_SIZE) {
		return Promise.resolve(new GuestSession(cookieBytes));
	}

	if (cookieBytes.length !== USER_COOKIE_SIZE) {
		return Promise.resolve(null);
	}

	var sessionId = cookieBytes.slice(0, SESSION_ID_SIZE);
	var sessionKey = cookieBytes.slice(SESSION_ID_SIZE);
	var sessionKeyHash = hashKey(sessionKey);
	var userSessionLifetime = this.userSessionLifetime;

	return request.database.query(getSelectSessionQuery(sessionId, userSessionLifetime))
		.then(function (result) {
			if (result.rows.length !== 1) {
				return null;
			}

			var row = result.rows[0];
			var expectedKeyHash = row.key_hash;

			return timingSafeCompare(expectedKeyHash, sessionKeyHash) ?
				new UserSession(sessionId, sessionKey, row.user) :
				null;
		});
};

SessionStorage.prototype.deleteSession = function (request, session) {
	return request.database.query(getDeleteSessionQuery(session.sessionId));
};

SessionStorage.prototype.createGuestSession = function () {
	var sessionId = crypto.randomBytes(SESSION_ID_SIZE);

	return Promise.resolve(new GuestSession(sessionId));
};

SessionStorage.prototype.createUserSession = function (request, userId) {
	var sessionId = crypto.randomBytes(SESSION_ID_SIZE);
	var sessionKey = crypto.randomBytes(SESSION_KEY_SIZE);
	var sessionKeyHash = hashKey(sessionKey);

	return request.database.query(getCreateSessionQuery(sessionId, sessionKeyHash, userId))
		.return(new UserSession(sessionId, sessionKey, userId));
};

SessionStorage.prototype.getCookieHeader = function (session) {
	var parts = [
		this.cookieName + '=' + session.getCookie(),
		'Path=/',
	];

	if (this.cookieSecure) {
		parts.push('Secure');
	}

	if (session instanceof UserSession) {
		parts.push('Max-Age=' + this.userSessionLifetime);
	}

	parts.push('HttpOnly');
	parts.push('SameSite=Strict');

	return parts.join('; ');
};

Object.defineProperty(SessionStorage.prototype, 'middleware', {
	configurable: true,
	get: function () {
		var sessionStorage = this;

		return function middleware(request, response, next) {
			sessionStorage.readSession(request)
				.then(function (session) {
					request.session = session;

					response.setSession = function (newSession) {
						var existingHeaders = this.getHeader('Set-Cookie');

						if (!existingHeaders) {
							existingHeaders = [];
						} else if (typeof existingHeaders === 'string') {
							existingHeaders = [existingHeaders];
						}

						var newHeader = sessionStorage.getCookieHeader(newSession);
						var updatedHeaders = existingHeaders.concat([newHeader]);

						this.setHeader('Set-Cookie', updatedHeaders);

						sessionStorage.deleteSession(request, session);
					};

					if (session) {
						request.session = session;
						return Promise.resolve();
					}

					return sessionStorage.createGuestSession(request)
						.then(function (newSession) {
							request.session = newSession;
							response.setSession(newSession);
						});
				})
				.done(next, next);
		};
	},
});

exports.SessionStorage = SessionStorage;
