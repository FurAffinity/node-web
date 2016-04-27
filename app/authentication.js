"use strict";

var bluebird = require("bluebird");
var bcrypt = require("bcrypt-small");

var compareAsync = bluebird.promisify(bcrypt.compare);
var hashAsync = bluebird.promisify(bcrypt.hash);

var config = require("./config");
var database = require("./database");

var ApplicationError = require("./errors").ApplicationError;

function NoUserError() {
	ApplicationError.call(this, "No user with the given username exists");
}

ApplicationError.extend(NoUserError);

function UserNotActiveError() {
	ApplicationError.call(this, "This account has not yet been activated");
}

ApplicationError.extend(UserNotActiveError);

function InvalidCredentialsError() {
	ApplicationError.call(this, "Incorrect username or password");
}

ApplicationError.extend(InvalidCredentialsError);

function getSelectPasswordQuery(username) {
	return {
		name: "select_password",
		text: "SELECT id, password_hash, active FROM users WHERE username = $1",
		values: [username],
	};
}

function getRehashPasswordQuery(userId, oldHash, newHash) {
	return {
		name: "rehash_password",
		text: "UPDATE users SET password_hash = $3 WHERE id = $1 AND password_hash = $2",
		values: [userId, oldHash, newHash],
	};
}

function rehashIfNecessary(userId, password, passwordHash) {
	if (bcrypt.getRounds(passwordHash) === config.bcrypt.log_rounds) {
		return bluebird.resolve();
	}

	return hashAsync(password, config.bcrypt.log_rounds).then(function (newHash) {
		return database.queryAsync(getRehashPasswordQuery(userId, passwordHash, newHash));
	});
}

function authenticate(username, password) {
	return database.queryAsync(getSelectPasswordQuery(username)).then(function (result) {
		if (result.rows.length !== 1) {
			return bluebird.reject(new NoUserError());
		}

		var row = result.rows[0];

		if (!row.active) {
			return bluebird.reject(new UserNotActiveError());
		}

		var userId = row.id;
		var passwordHash = row.password_hash;

		return compareAsync(password, passwordHash).then(function (passwordCorrect) {
			if (passwordCorrect) {
				rehashIfNecessary(userId, password, passwordHash);
				return userId;
			} else {
				return bluebird.reject(new InvalidCredentialsError());
			}
		});
	});
}

exports.authenticate = authenticate;
