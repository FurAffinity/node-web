'use strict';

var bluebird = require('bluebird');

function getReplaceWithUser(sessionStore, request, response) {
	return function replaceWithUser(userId) {
		var session = this;

		return sessionStore.createUserSession(userId).then(function (newSession) {
			var newCookieHeader = sessionStore.getCookieHeader(newSession);

			response.setHeader('Set-Cookie', newCookieHeader);
			request.session = newSession;

			if (session.userId === null) {
				return bluebird.resolve();
			} else {
				return sessionStore.deleteUserSession(session.sessionId);
			}
		});
	};
}

function getReplaceWithGuest(sessionStore, request, response) {
	return function replaceWithGuest() {
		var session = this;

		if (this.userId === null) {
			return bluebird.resolve();
		}

		return sessionStore.createGuestSession().then(function (newSession) {
			var newCookieHeader = sessionStore.getCookieHeader(newSession);

			response.setHeader('Set-Cookie', newCookieHeader);
			request.session = newSession;

			return sessionStore.deleteUserSession(session.sessionId);
		});
	};
}

function getMiddleware(sessionStore) {
	return function (request, response, next) {
		function nextWithSession(session) {
			Object.defineProperty(session, 'replaceWithUser', {
				enumerable: false,
				configurable: true,
				writable: true,
				value: getReplaceWithUser(sessionStore, request, response),
			});

			Object.defineProperty(session, 'replaceWithGuest', {
				enumerable: false,
				configurable: true,
				writable: true,
				value: getReplaceWithGuest(sessionStore, request, response),
			});

			request.session = session;
			next();
		}

		function nextWithUpdatedSession(session) {
			var cookieHeader = sessionStore.getCookieHeader(session);
			response.setHeader('Set-Cookie', cookieHeader);

			nextWithSession(session);
		}

		function nextWithNewSession() {
			sessionStore.createGuestSession().done(
				nextWithUpdatedSession,
				next
			);
		}

		var sessionCookie = request.cookies.get(sessionStore.cookieName);

		if (!sessionCookie) {
			nextWithNewSession();
			return;
		}

		sessionStore.readCookie(sessionCookie).done(
			function (sessionInfo) {
				if (!sessionInfo.session) {
					nextWithNewSession();
				} else if (sessionInfo.modified) {
					nextWithUpdatedSession(sessionInfo.session);
				} else {
					nextWithSession(sessionInfo.session);
				}
			},
			next
		);
	};
}

function SessionStore(options) {
	this.cookieName = options.cookieName;
	this.cookieSecure = options.cookieSecure;
}

Object.defineProperty(SessionStore.prototype, 'middleware', {
	configurable: true,
	get: function () {
		return getMiddleware(this);
	},
});

exports.SessionStore = SessionStore;
