"use strict";

var bluebird = require("bluebird");
var crypto = require("crypto");

var Session = require("./session").Session;
var SessionStore = require("./store").SessionStore;
var timingSafeCompare = require("../timing-safe-compare").timingSafeCompare;

var SESSION_ID_SIZE = 18;
var SESSION_KEY_SIZE = 18;
var SESSION_MAC_SIZE = 18;

var GUEST_COOKIE_SIZE = SESSION_ID_SIZE;
var USER_COOKIE_SIZE =
	SESSION_ID_SIZE +
	SESSION_KEY_SIZE +
	SESSION_MAC_SIZE;

function signSession(macKey, sessionId, sessionKey) {
	return crypto.createHmac("sha256", macKey)
		.update(sessionId)
		.update(sessionKey)
		.digest()
		.slice(0, SESSION_MAC_SIZE);
}

function getSelectSessionQuery(sessionId) {
	return {
		name: "select_session",
		text: 'SELECT key, next_key, "user", updated FROM sessions WHERE id = $1',
		values: [sessionId],
	};
}

function getInsertSessionQuery(sessionId, sessionKey, userId) {
	return {
		name: "insert_session",
		text: 'INSERT INTO sessions (id, key, "user") VALUES ($1, $2, $3)',
		values: [sessionId, sessionKey, userId],
	};
}

function getDeleteSessionQuery(sessionId) {
	return {
		name: "delete_session",
		text: "DELETE FROM sessions WHERE id = $1",
		values: [sessionId],
	};
}

function getUpdateKeyQuery(sessionId, nextKey) {
	return {
		name: "update_session_key",
		text: "UPDATE sessions SET key = next_key, next_key = NULL, updated = NOW() WHERE id = $1 AND next_key = $2",
		values: [sessionId, nextKey],
	};
}

function getUpdateNextKeyQuery(sessionId, nextKey) {
	return {
		name: "update_session_next_key",
		text: "UPDATE sessions SET next_key = $2 WHERE id = $1",
		values: [sessionId, nextKey],
	};
}

function getDeleteExpiredSessionsQuery(userSessionLifetime) {
	return {
		name: "delete_expired_sessions",
		text: "DELETE FROM sessions WHERE created < NOW() - $1 * INTERVAL '1 SECOND'",
		values: [userSessionLifetime],
	};
}

function DatabaseSessionStore(options) {
	SessionStore.call(this, options);

	if (options.macKey.length !== 32) {
		throw new Error("Session MAC key should be 32 bytes");
	}

	this.macKey = options.macKey;
	this.database = options.database;
	this.userSessionRekeyTime = options.userSessionRekeyTime;
	this.userSessionLifetime = options.userSessionLifetime;
}

DatabaseSessionStore.prototype = Object.create(SessionStore.prototype, {
	constructor: {
		configurable: true,
		enumerable: true,
		writable: true,
		value: DatabaseSessionStore,
	},
});

DatabaseSessionStore.prototype.createUserSession =
	function createUserSession(userId) {
		var database = this.database;
		var randomBytes = crypto.randomBytes(SESSION_ID_SIZE + SESSION_KEY_SIZE);
		var sessionId = randomBytes.slice(0, SESSION_ID_SIZE);
		var sessionKey = randomBytes.slice(SESSION_ID_SIZE);

		return (
			database.queryAsync(getInsertSessionQuery(sessionId, sessionKey, userId))
				.return(new Session(sessionId, sessionKey, userId))
		);
	};

DatabaseSessionStore.prototype.createGuestSession =
	function createGuestSession() {
		var sessionId = crypto.randomBytes(SESSION_ID_SIZE);
		return bluebird.resolve(new Session(sessionId, null, null));
	};

DatabaseSessionStore.prototype.deleteUserSession =
	function deleteUserSession(sessionId) {
		return this.database.queryAsync(
			getDeleteSessionQuery(sessionId)
		);
	};

DatabaseSessionStore.prototype.deleteExpiredSessions =
	function deleteExpiredSessions() {
		return this.database.queryAsync(
			getDeleteExpiredSessionsQuery(this.userSessionLifetime)
		);
	};

DatabaseSessionStore.prototype.getCookie =
	function getCookie(session) {
		var sessionId = session.sessionId;
		var sessionKey = session.sessionKey;

		if (session.userId === null) {
			return sessionId.toString("base64");
		} else {
			var mac = signSession(
				this.macKey,
				sessionId,
				sessionKey
			);

			return Buffer.concat([
				sessionId,
				sessionKey,
				mac,
			]).toString("base64");
		}
	};

DatabaseSessionStore.prototype.readCookie =
	function readCookie(sessionCookie) {
		var sessionStore = this;
		var database = this.database;
		var cookieBytes = Buffer.from(sessionCookie, "base64");

		if (cookieBytes.length === GUEST_COOKIE_SIZE) {
			return bluebird.resolve({
				modified: false,
				session: new Session(cookieBytes, null, null),
			});
		}

		if (cookieBytes.length !== USER_COOKIE_SIZE) {
			return bluebird.resolve({
				modified: false,
				session: null,
			});
		}

		var sessionId = cookieBytes.slice(0, SESSION_ID_SIZE);
		var sessionKey = cookieBytes.slice(SESSION_ID_SIZE, SESSION_ID_SIZE + SESSION_KEY_SIZE);
		var mac = cookieBytes.slice(SESSION_ID_SIZE + SESSION_KEY_SIZE);
		var expectedMac = signSession(
			this.macKey,
			sessionId,
			sessionKey
		);

		if (!timingSafeCompare(expectedMac, mac)) {
			return bluebird.resolve({
				modified: false,
				session: null,
			});
		}

		function confirmSessionKey(userId) {
			return (
				database.queryAsync(getUpdateKeyQuery(sessionId, sessionKey))
					.return({
						modified: false,
						session: new Session(sessionId, sessionKey, userId),
					})
			);
		}

		function refreshSessionKey(userId) {
			var nextKey = crypto.randomBytes(SESSION_KEY_SIZE);

			return (
				database.queryAsync(getUpdateNextKeyQuery(sessionId, nextKey))
					.return({
						modified: true,
						session: new Session(sessionId, nextKey, userId),
					})
			);
		}

		function refreshSessionKeyIfStale(userId, updated) {
			var timeSinceUpdate = new Date() - updated;
			var rekeyTime = 1000 * sessionStore.userSessionRekeyTime;

			if (timeSinceUpdate > rekeyTime) {
				return refreshSessionKey(userId);
			}

			return bluebird.resolve({
				modified: false,
				session: new Session(sessionId, sessionKey, userId),
			});
		}

		function deleteForkedSession() {
			return (
				sessionStore.deleteUserSession(sessionId)
					.return({
						modified: false,
						session: null,
					})
			);
		}

		function handleRow(row) {
			var expectedKey = row.key;
			var expectedNextKey = row.next_key;
			var updated = row.updated;
			var userId = row.user;

			if (expectedNextKey !== null && timingSafeCompare(expectedNextKey, sessionKey)) {
				return confirmSessionKey(userId);
			} else if (timingSafeCompare(expectedKey, sessionKey)) {
				return refreshSessionKeyIfStale(userId, updated);
			} else {
				return deleteForkedSession();
			}
		}

		return (
			database.queryAsync(getSelectSessionQuery(sessionId))
				.then(function (result) {
					if (result.rows.length === 1) {
						return handleRow(result.rows[0]);
					} else {
						return {
							modified: false,
							session: null,
						};
					}
				})
		);
	};

DatabaseSessionStore.prototype.getCookieHeader =
	function getCookieHeader(session) {
		var responseCookie = this.getCookie(session);
		var cookieHeaderParts = [
			this.cookieName + "=" + responseCookie,
			"Path=/",
		];

		if (this.cookieSecure) {
			cookieHeaderParts.push("Secure");
		}

		if (session.userId !== null) {
			cookieHeaderParts.push("Max-Age=" + this.userSessionLifetime);
		}

		cookieHeaderParts.push("HttpOnly");

		return cookieHeaderParts.join("; ");
	};

exports.DatabaseSessionStore = DatabaseSessionStore;
