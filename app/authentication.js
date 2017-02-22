'use strict';

const bluebird = require('bluebird');
const bcrypt = require('bcrypt-small');

const compareAsync = bluebird.promisify(bcrypt.compare);
const hashAsync = bluebird.promisify(bcrypt.hash);

const config = require('./config');

const ApplicationError = require('./errors').ApplicationError;

class NoUserError extends ApplicationError {
	constructor() {
		super('No user with the given username exists');
	}
}

ApplicationError.extendClass(NoUserError);

class UserNotActiveError extends ApplicationError {
	constructor() {
		super('This account has not yet been activated');
	}
}

ApplicationError.extendClass(UserNotActiveError);

class InvalidCredentialsError extends ApplicationError {
	constructor() {
		super('Incorrect username or password');
	}
}

ApplicationError.extendClass(InvalidCredentialsError);

const getSelectPasswordQuery = username =>
	({
		name: 'select_password',
		text: 'SELECT id, password_hash, active FROM users WHERE username = $1',
		values: [username],
	});

const getRehashPasswordQuery = (userId, oldHash, newHash) =>
	({
		name: 'rehash_password',
		text: 'UPDATE users SET password_hash = $3 WHERE id = $1 AND password_hash = $2',
		values: [userId, oldHash, newHash],
	});

const rehashIfNecessary = (context, userId, password, passwordHash) => {
	if (bcrypt.getRounds(passwordHash) === config.bcrypt.log_rounds) {
		return bluebird.resolve();
	}

	return hashAsync(password, config.bcrypt.log_rounds).then(newHash => {
		return context.database.query(getRehashPasswordQuery(userId, passwordHash, newHash));
	});
};

const authenticate = (context, username, password) =>
	context.database.query(getSelectPasswordQuery(username)).then(result => {
		if (result.rows.length !== 1) {
			return bluebird.reject(new NoUserError());
		}

		const row = result.rows[0];

		if (!row.active) {
			return bluebird.reject(new UserNotActiveError());
		}

		const userId = row.id;
		const passwordHash = row.password_hash;

		return compareAsync(password, passwordHash).then(passwordCorrect => {
			if (passwordCorrect) {
				rehashIfNecessary(context, userId, password, passwordHash);
				return userId;
			} else {
				return bluebird.reject(new InvalidCredentialsError());
			}
		});
	});

exports.NoUserError = NoUserError;
exports.UserNotActiveError = UserNotActiveError;
exports.InvalidCredentialsError = InvalidCredentialsError;
exports.authenticate = authenticate;
