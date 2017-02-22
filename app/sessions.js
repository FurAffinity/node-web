'use strict';

const Promise = require('bluebird');
const crypto = require('crypto');

const timingSafeCompare = require('./timing-safe-compare').timingSafeCompare;

const SESSION_ID_SIZE = 18;
const SESSION_KEY_SIZE = 18;

const GUEST_COOKIE_SIZE = SESSION_ID_SIZE;
const USER_COOKIE_SIZE = SESSION_ID_SIZE + SESSION_KEY_SIZE;

const hashKey = key =>
	crypto.createHash('sha256')
		.update(key)
		.digest();

const getCreateSessionQuery = (id, keyHash, userId) =>
	({
		name: 'create_session',
		text: 'INSERT INTO sessions (id, key_hash, "user") VALUES ($1, $2, $3)',
		values: [id, keyHash, userId],
	});

const getSelectSessionQuery = (id, sessionLifetime) =>
	({
		name: 'select_session',
		text: `SELECT key_hash, "user" FROM sessions WHERE id = $1 AND created >= NOW() - $2 * INTERVAL '1 second'`,
		values: [id, sessionLifetime],
	});

const getDeleteSessionQuery = id =>
	({
		name: 'delete_session',
		text: 'DELETE FROM sessions WHERE id = $1',
		values: [id],
	});

class GuestSession {
	constructor(sessionId) {
		this.sessionId = sessionId;
	}

	getCookie() {
		return this.sessionId.toString('base64');
	}
}

Object.defineProperty(GuestSession.prototype, 'userId', {
	configurable: true,
	value: null,
});

class UserSession {
	constructor(sessionId, sessionKey, userId) {
		if (!Number.isSafeInteger(userId) || userId <= 0) {
			throw new TypeError('User id should be a positive integer');
		}

		this.sessionId = sessionId;
		this.sessionKey = sessionKey;
		this.userId = userId;
	}

	getCookie() {
		return Buffer.concat([this.sessionId, this.sessionKey]).toString('base64');
	}
}

class SessionStorage {
	constructor(options) {
		const cookieName = options.cookieName;
		const cookieSecure = options.cookieSecure;
		const userSessionLifetime = options.userSessionLifetime;

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

	readSession(request) {
		const sessionCookie = request.cookies.get(this.cookieName);

		if (!sessionCookie) {
			return Promise.resolve(null);
		}

		const cookieBytes = Buffer.from(sessionCookie, 'base64');

		if (cookieBytes.length === GUEST_COOKIE_SIZE) {
			return Promise.resolve(new GuestSession(cookieBytes));
		}

		if (cookieBytes.length !== USER_COOKIE_SIZE) {
			return Promise.resolve(null);
		}

		const sessionId = cookieBytes.slice(0, SESSION_ID_SIZE);
		const sessionKey = cookieBytes.slice(SESSION_ID_SIZE);
		const sessionKeyHash = hashKey(sessionKey);
		const userSessionLifetime = this.userSessionLifetime;

		return request.context.database.query(getSelectSessionQuery(sessionId, userSessionLifetime))
			.then(result => {
				if (result.rows.length !== 1) {
					return null;
				}

				const row = result.rows[0];
				const expectedKeyHash = row.key_hash;

				return timingSafeCompare(expectedKeyHash, sessionKeyHash) ?
					new UserSession(sessionId, sessionKey, row.user) :
					null;
			});
	}

	deleteSession(request, session) {
		return request.context.database.query(getDeleteSessionQuery(session.sessionId));
	}

	createGuestSession() {
		const sessionId = crypto.randomBytes(SESSION_ID_SIZE);

		return Promise.resolve(new GuestSession(sessionId));
	}

	createUserSession(request, userId) {
		const sessionId = crypto.randomBytes(SESSION_ID_SIZE);
		const sessionKey = crypto.randomBytes(SESSION_KEY_SIZE);
		const sessionKeyHash = hashKey(sessionKey);

		return request.context.database.query(getCreateSessionQuery(sessionId, sessionKeyHash, userId))
			.return(new UserSession(sessionId, sessionKey, userId));
	}

	getCookieHeader(session) {
		const parts = [
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
		parts.push('SameSite=Lax');

		return parts.join('; ');
	}
}

Object.defineProperty(SessionStorage.prototype, 'middleware', {
	configurable: true,
	get: function () {
		const sessionStorage = this;

		return (request, response, next) => {
			sessionStorage.readSession(request)
				.then(session => {
					request.session = session;

					response.setSession = function (newSession) {
						let existingHeaders = this.getHeader('Set-Cookie');

						if (!existingHeaders) {
							existingHeaders = [];
						} else if (typeof existingHeaders === 'string') {
							existingHeaders = [existingHeaders];
						}

						const newHeader = sessionStorage.getCookieHeader(newSession);
						const updatedHeaders = existingHeaders.concat([newHeader]);

						this.setHeader('Set-Cookie', updatedHeaders);

						if (session !== null) {
							sessionStorage.deleteSession(request, session);
						}

						session = newSession;
					};

					if (session) {
						request.session = session;
						return Promise.resolve();
					}

					return sessionStorage.createGuestSession(request)
						.then(newSession => {
							request.session = newSession;
							response.setSession(newSession);
						});
				})
				.done(next, next);
		};
	},
});

exports.SessionStorage = SessionStorage;
