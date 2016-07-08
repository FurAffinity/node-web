'use strict';

function Session(sessionId, sessionKey, userId) {
	this.sessionId = sessionId;
	this.sessionKey = sessionKey;
	this.userId = userId;
}

exports.Session = Session;
