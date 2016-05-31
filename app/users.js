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
var POSTGRESQL_SERIALIZATION_FAILURE = "40001";

var NON_CANONICAL_USERNAME_CHARACTER = /_/g;
var DISPLAY_USERNAME = /^[\w.~-]+$/;

var recoveryCodeByteLength = 6;
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
				display_username, full_name, profile_text, profile_type, image_files.hash AS image_hash, image_type, banner_files.hash AS banner_hash, banner_type, created
			FROM users
				LEFT JOIN files image_files ON users.image = image_files.id
				LEFT JOIN files banner_files ON users.banner = banner_files.id
			WHERE users.id = $1 AND active
		`,
		values: [userId],
	};
}

function getUpdateProfileQuery(userId, profileInfo) {
	var name = "update_profile";
	var set = ["full_name = $2", "profile_text = $3", "profile_type = $4"];
	var values = [userId, profileInfo.fullName, profileInfo.profileText, profileInfo.profileType];

	var profileImage = profileInfo.profileImage;

	if (profileImage !== null) {
		name += "_with_image";
		set.push("image = $" + (set.length + 2));
		values.push(profileImage.id);

		set.push("image_type = $" + (set.length + 2));
		values.push(profileImage.type);
	}

	var banner = profileInfo.banner;

	if (banner !== null) {
		name += "_with_banner";
		set.push("banner = $" + (set.length + 2));
		values.push(banner.id);

		set.push("banner_type = $" + (set.length + 2));
		values.push(banner.type);
	}

	return {
		name: name,
		text: "UPDATE users SET " + set.join(", ") + " WHERE id = $1",
		values: values,
	};
}

function getSelectUserStatisticsQuery(userId) {
	return {
		name: "select_user_statistics",
		text: "SELECT COUNT(*) AS submissions FROM submissions WHERE owner = $1 AND published",
		values: [userId],
	};
}

function getSetupTwoFactorQuery(userId, key, lastUsedCounter) {
	return {
		name: "setup_two_factor",
		text: "UPDATE users SET totp_key = $2, totp_last_used_counter = $3 WHERE id = $1 AND totp_key IS NULL",
		values: [userId, key, lastUsedCounter],
	};
}

function getDeleteTwoFactorRecoveryQuery(userId) {
	return {
		name: "delete_two_factor_recovery",
		text: 'DELETE FROM two_factor_recovery WHERE "user" = $1',
		values: [userId],
	};
}

function getInsertTwoFactorRecoveryQuery(userId, recoveryCodes) {
	// pg can’t serialize BYTEA[], so recovery codes go through base64.
	return {
		name: "insert_two_factor_recovery",
		text: `
			INSERT INTO two_factor_recovery ("user", recovery_code)
			SELECT $1, decode(recovery_code, 'base64') FROM UNNEST ($2::TEXT[]) AS recovery_code
		`,
		values: [
			userId,
			recoveryCodes.map(function (code) {
				return code.toString("base64");
			}),
		],
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
				profileType: row.profile_type,
				created: row.created,
				image: getFile(row.image_hash, row.image_type),
				banner: getFile(row.banner_hash, row.banner_type),
			};
		});
}

function updateProfile(userId, profileInfo) {
	return database.queryAsync(getUpdateProfileQuery(userId, profileInfo))
		.then(function (result) {
			return result.rowCount === 1 ?
				bluebird.resolve() :
				bluebird.reject(new Error("Expected user"));
		});
}

function getUserStatistics(userId) {
	return database.queryAsync(getSelectUserStatisticsQuery(userId))
		.then(function (result) {
			return result.rows[0];
		});
}

function getRecoveryCodes() {
	var recoveryCodes = [];

	for (var i = 0; i < config.totp.recovery_codes; i++) {
		recoveryCodes.push(crypto.randomBytes(recoveryCodeByteLength));
	}

	return recoveryCodes;
}

function setupTwoFactor(userId, key, lastUsedCounter) {
	var recoveryCodes = getRecoveryCodes();

	return database.queryAsync(getSetupTwoFactorQuery(userId, key, lastUsedCounter))
		.then(function (result) {
			if (result.rowCount !== 1) {
				return bluebird.reject(new Error("Two-factor authentication is already enabled for this account"));
			}

			return database.queryAsync(getInsertTwoFactorRecoveryQuery(userId, recoveryCodes));
		});
}

function regenerateTwoFactorRecovery(userId) {
	var recoveryCodes = getRecoveryCodes();

	function useTransaction(client) {
		return client.queryAsync("SET TRANSACTION SERIALIZATION LEVEL REPEATABLE READ")
			.then(function () {
				return client.queryAsync(getDeleteTwoFactorRecoveryQuery(userId));
			})
			.then(function () {
				return client.queryAsync(getInsertTwoFactorRecoveryQuery(userId));
			});
	}

	function executeAndRetry() {
		return database.withTransaction(useTransaction)
			.catch(function (error) {
				if (error.code === POSTGRESQL_SERIALIZATION_FAILURE) {
					return executeAndRetry();
				}

				return bluebird.reject(error);
			});
	}

	return executeAndRetry()
		.return(recoveryCodes);
}

exports.EmailInvalidError = EmailInvalidError;
exports.UsernameConflictError = UsernameConflictError;
exports.UsernameInvalidError = UsernameInvalidError;
exports.getCanonicalUsername = getCanonicalUsername;
exports.getUserMeta = getUserMeta;
exports.getUserStatistics = getUserStatistics;
exports.regenerateTwoFactorRecovery = regenerateTwoFactorRecovery;
exports.registerUser = registerUser;
exports.setupTwoFactor = setupTwoFactor;
exports.updateProfile = updateProfile;
exports.verifyRegistrationKey = verifyRegistrationKey;
exports.viewProfile = viewProfile;
