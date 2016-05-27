"use strict";

var bcrypt = require("bcrypt-small");
var bluebird = require("bluebird");
var crypto = require("crypto");

var hashAsync = bluebird.promisify(bcrypt.hash);

var ApplicationError = require("./errors").ApplicationError;
var config = require("./config");
var database = require("./database");
var email = require("./email");

var sendAsync = bluebird.promisify(email.send);
var timingSafeCompare = require("./timing-safe-compare").timingSafeCompare;
var redisClient = require("./redis").client;

var POSTGRESQL_UNIQUE_VIOLATION = "23505";

var NON_CANONICAL_USERNAME_CHARACTER = /_/g;
var DISPLAY_USERNAME = /^[\w.~-]+$/;

var registrationEmailTemplate = email.templateEnvironment.getTemplate("registration", true);
var registrationDuplicateEmailTemplate = email.templateEnvironment.getTemplate("registration-duplicate", true);

function UsernameConflictError() {
	ApplicationError.call(this, "A user with this username already exists");
}

ApplicationError.extend(UsernameConflictError);

function UsernameInvalidError() {
	ApplicationError.call(this, "Invalid username");
}

ApplicationError.extend(UsernameInvalidError);

function EmailInvalidError() {
	ApplicationError.call(this, "Invalid e-mail address");
}

ApplicationError.extend(EmailInvalidError);

function RegistrationKeyInvalidError() {
	ApplicationError.call(this, "The registration key is invalid or has expired");
}

ApplicationError.extend(RegistrationKeyInvalidError);

function toPathSafeBase64(buffer) {
	return (
		buffer.toString("base64")
			.replace(/=+$/, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
	);
}

function getFile(hash, type) {
	return hash === null ?
		null :
		{ hash: hash, type: type };
}

function getSelectUserMetaQuery(userId) {
	return {
		name: "select_user_meta",
		text: "SELECT username, display_username FROM users WHERE id = $1",
		values: [userId],
	};
}

function getInsertUnregisteredUserQuery(userInfo) {
	return {
		name: "insert_unregistered_user",
		text: "INSERT INTO users (username, email, password_hash, display_username) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id",
		values: [userInfo.username, userInfo.email, userInfo.passwordHash, userInfo.displayUsername],
	};
}

function getFindConflictingUserQuery(canonicalEmail) {
	return {
		name: "find_conflicting_user",
		text: "SELECT display_username FROM users WHERE email = $1",
		values: [canonicalEmail],
	};
}

function getInsertRegistrationKeyQuery(userId, registrationKey) {
	return {
		name: "insert_registration_key",
		text: 'INSERT INTO registration_keys ("user", key) VALUES ($1, $2)',
		values: [userId, registrationKey],
	};
}

function getDeleteRegistrationKeyQuery(userId) {
	return {
		name: "select_registration_key",
		text: 'DELETE FROM registration_keys WHERE "user" = $1 RETURNING key',
		values: [userId],
	};
}

function getActivateUserQuery(userId) {
	return {
		name: "activate_user",
		text: "UPDATE users SET active = TRUE WHERE id = $1",
		values: [userId],
	};
}

function getViewProfileQuery(userId) {
	return {
		name: "view_profile",
		text: `
			SELECT
				display_username, full_name, profile_text, files.hash AS image_hash, image_type, created
			FROM users
				LEFT JOIN files ON users.image = files.id
			WHERE users.id = $1 AND active
		`,
		values: [userId],
	};
}

function getSelectUserStatisticsQuery(userId) {
	return {
		name: "select_user_statistics",
		text: "SELECT COUNT(*) AS submissions FROM submissions WHERE owner = $1 AND published",
		values: [userId],
	};
}

function getCanonicalUsername(displayUsername) {
	return (
		displayUsername
			.replace(NON_CANONICAL_USERNAME_CHARACTER, "")
			.toLowerCase()
	);
}

function isValidDisplayUsername(displayUsername) {
	var canonicalUsername = getCanonicalUsername(displayUsername);

	return (
		DISPLAY_USERNAME.test(displayUsername) &&
		canonicalUsername.length >= 3 &&
		canonicalUsername.charAt(0) !== "."
	);
}

function getUserMeta(userId) {
	return redisClient.hgetAsync("display_usernames", userId)
		.then(function (result) {
			if (result) {
				return {
					id: userId,
					username: getCanonicalUsername(result),
					displayUsername: result,
				};
			}

			return database.queryAsync(getSelectUserMetaQuery(userId))
				.then(function (result) {
					if (result.rows.length !== 1) {
						return bluebird.reject(new Error("Expected user"));
					}

					var row = result.rows[0];

					return {
						id: userId,
						username: row.username,
						displayUsername: row.display_username,
					};
				})
				.tap(function (userMeta) {
					redisClient.hsetAsync("display_usernames", userId, userMeta.displayUsername);
				});
		});
}

function registerUser(userInfo) {
	var displayUsername = userInfo.username;

	if (!isValidDisplayUsername(displayUsername)) {
		return bluebird.reject(new UsernameInvalidError());
	}

	var canonicalUsername = getCanonicalUsername(displayUsername);
	var canonicalEmail = email.getCanonicalAddress(userInfo.email);

	if (canonicalEmail === null) {
		return bluebird.reject(new EmailInvalidError());
	}

	return hashAsync(userInfo.password, config.bcrypt.log_rounds).then(function (passwordHash) {
		function useTransaction(client) {
			return client.queryAsync(getInsertUnregisteredUserQuery({
				username: canonicalUsername,
				email: canonicalEmail,
				passwordHash: passwordHash,
				displayUsername: displayUsername,
			}))
				.then(function (result) {
					if (result.rows.length !== 1) {
						return bluebird.all([
							client.queryAsync(getFindConflictingUserQuery(canonicalEmail))
								.then(function (result) {
									return result.rows[0].display_username;
								}),
							client.queryAsync(getInsertUnregisteredUserQuery({
								username: canonicalUsername,
								email: null,
								passwordHash: passwordHash,
								displayUsername: displayUsername,
							})),
						]).spread(function (existingUsername) {
							return sendAsync({
								to: canonicalEmail,
								from: config.registration.from_address,
								subject: "Fur Affinity registration attempt",
								body: registrationDuplicateEmailTemplate.render({
									username: displayUsername,
									existing_username: existingUsername,
								}),
							});
						});
					}

					var userId = result.rows[0].id;
					var registrationKey = crypto.randomBytes(config.registration.registration_key_size);

					return client.queryAsync(getInsertRegistrationKeyQuery(userId, registrationKey))
						.then(function () {
							return sendAsync({
								to: canonicalEmail,
								from: config.registration.from_address,
								subject: "Fur Affinity registration key",
								body: registrationEmailTemplate.render({
									username: displayUsername,
									id: userId,
									key: toPathSafeBase64(registrationKey),
								}),
							});
						});
				})
				.return(canonicalEmail);
		}

		return database.withTransaction(useTransaction)
			.catch(function (error) {
				if (error.code === POSTGRESQL_UNIQUE_VIOLATION && error.constraint === "users_username_key") {
					return bluebird.reject(new UsernameConflictError());
				}

				return bluebird.reject(error);
			});
	});
}

function verifyRegistrationKey(userId, key) {
	function useTransaction(client) {
		return client.queryAsync(getDeleteRegistrationKeyQuery(userId))
			.then(function (result) {
				if (result.rows.length !== 1) {
					return bluebird.reject(new RegistrationKeyInvalidError());
				}

				var expectedKey = result.rows[0].key;

				if (!timingSafeCompare(expectedKey, key)) {
					return bluebird.reject(new RegistrationKeyInvalidError());
				}

				return bluebird.resolve();
			})
			.then(function () {
				return client.queryAsync(getActivateUserQuery(userId));
			});
	}

	if (key.length !== config.registration.registration_key_size) {
		return bluebird.reject(new RegistrationKeyInvalidError());
	}

	return database.withTransaction(useTransaction);
}

function viewProfile(userId) {
	return database.queryAsync(getViewProfileQuery(userId))
		.then(function (result) {
			var row = result.rows[0];

			return {
				id: userId,
				displayUsername: row.display_username,
				fullName: row.full_name,
				profileText: row.profile_text,
				created: row.created,
				image: getFile(row.image_hash, row.image_type),
				banner: null,
			};
		});
}

function getUserStatistics(userId) {
	return database.queryAsync(getSelectUserStatisticsQuery(userId))
		.then(function (result) {
			return result.rows[0];
		});
}

exports.EmailInvalidError = EmailInvalidError;
exports.UsernameConflictError = UsernameConflictError;
exports.UsernameInvalidError = UsernameInvalidError;
exports.getCanonicalUsername = getCanonicalUsername;
exports.getUserMeta = getUserMeta;
exports.getUserStatistics = getUserStatistics;
exports.registerUser = registerUser;
exports.verifyRegistrationKey = verifyRegistrationKey;
exports.viewProfile = viewProfile;
