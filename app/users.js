'use strict';

const bcrypt = require('bcrypt-small');
const bluebird = require('bluebird');
const crypto = require('crypto');

const hashAsync = bluebird.promisify(bcrypt.hash);

const ApplicationError = require('./errors').ApplicationError;
const config = require('./config');
const email = require('./email');
const files = require('./files');
const postgresql = require('./database/postgresql');

const DisplayFile = files.DisplayFile;
const sendAsync = bluebird.promisify(email.send);
const timingSafeCompare = require('./timing-safe-compare').timingSafeCompare;

const POSTGRESQL_UNIQUE_VIOLATION = '23505';
const POSTGRESQL_SERIALIZATION_FAILURE = '40001';

const NON_CANONICAL_USERNAME_CHARACTER = /_/g;
const DISPLAY_USERNAME = /^[\w.~-]+$/;

const REGISTRATION_KEY_SIZE = 18;
const RECOVERY_CODE_BYTE_LENGTH = 6;

const registrationEmailTemplate = email.templateEnvironment.getTemplate('registration', true);
const registrationDuplicateEmailTemplate = email.templateEnvironment.getTemplate('registration-duplicate', true);

class UsernameConflictError extends ApplicationError {
	constructor() {
		super('A user with this username already exists');
	}
}

ApplicationError.extendClass(UsernameConflictError);

class UsernameInvalidError extends ApplicationError {
	constructor() {
		super('Invalid username');
	}
}

ApplicationError.extendClass(UsernameInvalidError);

class EmailInvalidError extends ApplicationError {
	constructor() {
		super('Invalid e-mail address');
	}
}

ApplicationError.extendClass(EmailInvalidError);

class RegistrationKeyInvalidError extends ApplicationError {
	constructor() {
		super('The registration key is invalid or has expired');
	}
}

ApplicationError.extendClass(RegistrationKeyInvalidError);

const hashKey = key =>
	crypto.createHash('sha256')
		.update(key)
		.digest();

const toPathSafeBase64 = buffer =>
	buffer.toString('base64')
		.replace(/=+$/, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');

const getSelectUserMetaQuery = userId =>
	({
		name: 'select_user_meta',
		text: `
			SELECT
				username, display_username, rating_preference,
				jsonb_agg(
					jsonb_build_object(
						'role', user_representations.role,
						'type', user_representations.type,
						'hash', encode(files.hash, 'hex')
					)
				) AS representations
			FROM users
				LEFT JOIN user_representations ON users.id = user_representations.user
				LEFT JOIN files ON user_representations.file = files.id
			WHERE users.id = $1
			GROUP BY users.id
		`,
		values: [userId],
	});

const getInsertUnregisteredUserQuery = userInfo =>
	({
		name: 'insert_unregistered_user',
		text: 'INSERT INTO users (username, email, password_hash, display_username) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id',
		values: [userInfo.username, userInfo.email, userInfo.passwordHash, userInfo.displayUsername],
	});

const getFindConflictingUserQuery = canonicalEmail =>
	({
		name: 'find_conflicting_user',
		text: 'SELECT display_username FROM users WHERE email = $1',
		values: [canonicalEmail],
	});

const getInsertRegistrationKeyQuery = (userId, registrationKeyHash) =>
	({
		name: 'insert_registration_key',
		text: 'INSERT INTO registration_keys ("user", key_hash) VALUES ($1, $2)',
		values: [userId, registrationKeyHash],
	});

const getDeleteRegistrationKeyQuery = userId =>
	({
		name: 'select_registration_key',
		text: 'DELETE FROM registration_keys WHERE "user" = $1 RETURNING key_hash',
		values: [userId],
	});

const getActivateUserQuery = userId =>
	({
		name: 'activate_user',
		text: 'UPDATE users SET active = TRUE WHERE id = $1',
		values: [userId],
	});

const getViewProfileQuery = userId =>
	({
		name: 'view_profile',
		text: `
			SELECT
				display_username, full_name, profile_text, profile_type, image_files.hash AS image_hash, image_type, banner_files.hash AS banner_hash, banner_type, created
			FROM users
				LEFT JOIN files image_files ON users.image = image_files.id
				LEFT JOIN files banner_files ON users.banner = banner_files.id
			WHERE users.id = $1 AND active
		`,
		values: [userId],
	});

const getUpdateProfileQuery = (userId, profileInfo) => {
	let name = 'update_profile';
	const set = ['full_name = $2', 'profile_text = $3', 'profile_type = $4'];
	const values = [userId, profileInfo.fullName, profileInfo.profileText, profileInfo.profileType];

	const profileImage = profileInfo.profileImage;

	if (profileImage !== null) {
		name += '_with_image';
		set.push('image = $' + (set.length + 2));
		values.push(profileImage.id);

		set.push('image_type = $' + (set.length + 2));
		values.push(profileImage.type);
	}

	const banner = profileInfo.banner;

	if (banner !== null) {
		name += '_with_banner';
		set.push('banner = $' + (set.length + 2));
		values.push(banner.id);

		set.push('banner_type = $' + (set.length + 2));
		values.push(banner.type);
	}

	return {
		name: name,
		text: 'UPDATE users SET ' + set.join(', ') + ' WHERE id = $1',
		values: values,
	};
};

const getUpdatePreferencesQuery = (userId, preferences) =>
	({
		name: 'update_preferences',
		text: 'UPDATE users SET rating_preference = $2 WHERE id = $1',
		values: [userId, preferences.rating],
	});

const getSelectUserStatisticsQuery = userId =>
	({
		name: 'select_user_statistics',
		text: 'SELECT COUNT(*) AS submissions FROM submissions WHERE owner = $1 AND published',
		values: [userId],
	});

const getSetupTwoFactorQuery = (userId, key, lastUsedCounter) =>
	({
		name: 'setup_two_factor',
		text: 'UPDATE users SET totp_key = $2, totp_last_used_counter = $3 WHERE id = $1 AND totp_key IS NULL',
		values: [userId, key, lastUsedCounter],
	});

const getDeleteTwoFactorRecoveryQuery = userId =>
	({
		name: 'delete_two_factor_recovery',
		text: 'DELETE FROM two_factor_recovery WHERE "user" = $1',
		values: [userId],
	});

const getInsertTwoFactorRecoveryQuery = (userId, recoveryCodes) =>
	({
		name: 'insert_two_factor_recovery',
		text: `
			INSERT INTO two_factor_recovery ("user", recovery_code)
			SELECT $1, recovery_code FROM UNNEST ($2::bytea[]) AS recovery_code
		`,
		values: [
			userId,
			postgresql.serializeByteaArray(recoveryCodes),
		],
	});

const getCanonicalUsername = displayUsername =>
	displayUsername
		.replace(NON_CANONICAL_USERNAME_CHARACTER, '')
		.toLowerCase();

const isValidDisplayUsername = displayUsername => {
	const canonicalUsername = getCanonicalUsername(displayUsername);

	return (
		DISPLAY_USERNAME.test(displayUsername) &&
		canonicalUsername.length >= 3 &&
		canonicalUsername.charAt(0) !== '.'
	);
};

// TODO: add caching when format is stable
const getUserMeta = (context, userId) =>
	context.database.query(getSelectUserMetaQuery(userId))
		.then(result => {
			if (result.rows.length !== 1) {
				return bluebird.reject(new Error('Expected user'));
			}

			const row = result.rows[0];

			return {
				id: userId,
				username: row.username,
				representations: row.representations,
				displayUsername: row.display_username,
				ratingPreference: row.rating_preference,
			};
		});

const registerUser = (context, userInfo) => {
	const displayUsername = userInfo.username;

	if (!isValidDisplayUsername(displayUsername)) {
		return bluebird.reject(new UsernameInvalidError());
	}

	const canonicalUsername = getCanonicalUsername(displayUsername);
	const canonicalEmail = email.getCanonicalAddress(userInfo.email);

	if (canonicalEmail === null) {
		return bluebird.reject(new EmailInvalidError());
	}

	return hashAsync(userInfo.password, config.bcrypt.log_rounds).then(passwordHash => {
		const useTransaction = client => {
			return client.query(getInsertUnregisteredUserQuery({
				username: canonicalUsername,
				email: canonicalEmail,
				passwordHash: passwordHash,
				displayUsername: displayUsername,
			}))
				.then(result => {
					if (result.rows.length !== 1) {
						return bluebird.all([
							client.query(getFindConflictingUserQuery(canonicalEmail))
								.then(result => result.rows[0].display_username),
							client.query(getInsertUnregisteredUserQuery({
								username: canonicalUsername,
								email: null,
								passwordHash: passwordHash,
								displayUsername: displayUsername,
							})),
						]).spread(existingUsername =>
							sendAsync({
								to: canonicalEmail,
								from: config.registration.from_address,
								subject: 'Fur Affinity registration attempt',
								body: registrationDuplicateEmailTemplate.render({
									username: displayUsername,
									existing_username: existingUsername,
								}),
							})
						);
					}

					const userId = result.rows[0].id;
					const registrationKey = crypto.randomBytes(REGISTRATION_KEY_SIZE);

					return client.query(getInsertRegistrationKeyQuery(userId, hashKey(registrationKey)))
						.then(() =>
							sendAsync({
								to: canonicalEmail,
								from: config.registration.from_address,
								subject: 'Fur Affinity registration key',
								body: registrationEmailTemplate.render({
									username: displayUsername,
									id: userId,
									key: toPathSafeBase64(registrationKey),
								}),
							})
						);
				})
				.return(canonicalEmail);
		};

		return context.database.withTransaction(useTransaction)
			.catch(error => {
				if (error.code === POSTGRESQL_UNIQUE_VIOLATION && error.constraint === 'users_username_key') {
					return bluebird.reject(new UsernameConflictError());
				}

				return bluebird.reject(error);
			});
	});
};

const verifyRegistrationKey = (context, userId, key) => {
	const useTransaction = client => {
		return client.query(getDeleteRegistrationKeyQuery(userId))
			.then(result => {
				if (result.rows.length !== 1) {
					return bluebird.reject(new RegistrationKeyInvalidError());
				}

				const expectedKeyHash = result.rows[0].key_hash;

				if (!timingSafeCompare(expectedKeyHash, hashKey(key))) {
					return bluebird.reject(new RegistrationKeyInvalidError());
				}

				return bluebird.resolve();
			})
			.then(() => client.query(getActivateUserQuery(userId)));
	};

	if (key.length !== REGISTRATION_KEY_SIZE) {
		return bluebird.reject(new RegistrationKeyInvalidError());
	}

	return context.database.withTransaction(useTransaction);
};

const viewProfile = (context, userId) => {
	return context.database.query(getViewProfileQuery(userId))
		.then(result => {
			const row = result.rows[0];

			return {
				id: userId,
				displayUsername: row.display_username,
				fullName: row.full_name,
				profileText: row.profile_text,
				profileType: row.profile_type,
				created: row.created,
				image: DisplayFile.from(row.image_hash, row.image_type),
				banner: DisplayFile.from(row.banner_hash, row.banner_type),
			};
		});
};

const updateProfile = (context, userId, profileInfo) =>
	context.database.query(getUpdateProfileQuery(userId, profileInfo))
		.then(result =>
			result.rowCount === 1 ?
				bluebird.resolve() :
				bluebird.reject(new Error('Expected user'))
		);

const updatePreferences = (context, userId, preferences) =>
	context.database.query(getUpdatePreferencesQuery(userId, preferences))
		.then(result =>
			result.rowCount === 1 ?
				bluebird.resolve() :
				bluebird.reject(new Error('Expected user'))
		);

const getUserStatistics = (context, userId) =>
	context.database.query(getSelectUserStatisticsQuery(userId))
		.then(result => result.rows[0]);

const getRecoveryCodes = () => {
	const recoveryCodes = [];

	for (let i = 0; i < config.totp.recovery_codes; i++) {
		recoveryCodes.push(crypto.randomBytes(RECOVERY_CODE_BYTE_LENGTH));
	}

	return recoveryCodes;
};

const setupTwoFactor = (context, userId, key, lastUsedCounter) => {
	const recoveryCodes = getRecoveryCodes();

	return context.database.query(getSetupTwoFactorQuery(userId, key, lastUsedCounter))
		.then(result => {
			if (result.rowCount !== 1) {
				return bluebird.reject(new Error('Two-factor authentication is already enabled for this account'));
			}

			return context.database.query(getInsertTwoFactorRecoveryQuery(userId, recoveryCodes));
		});
};

const regenerateTwoFactorRecovery = (context, userId) => {
	const recoveryCodes = getRecoveryCodes();

	const useTransaction = client =>
		client.query('SET TRANSACTION SERIALIZATION LEVEL REPEATABLE READ')
			.then(() => client.query(getDeleteTwoFactorRecoveryQuery(userId)))
			.then(() => client.query(getInsertTwoFactorRecoveryQuery(userId, recoveryCodes)));

	const executeAndRetry = () =>
		context.database.withTransaction(useTransaction)
			.catch(error => {
				if (error.code === POSTGRESQL_SERIALIZATION_FAILURE) {
					return executeAndRetry();
				}

				return bluebird.reject(error);
			});

	return executeAndRetry()
		.return(recoveryCodes);
};

exports.EmailInvalidError = EmailInvalidError;
exports.UsernameConflictError = UsernameConflictError;
exports.UsernameInvalidError = UsernameInvalidError;
exports.getCanonicalUsername = getCanonicalUsername;
exports.getUserMeta = getUserMeta;
exports.getUserStatistics = getUserStatistics;
exports.regenerateTwoFactorRecovery = regenerateTwoFactorRecovery;
exports.registerUser = registerUser;
exports.setupTwoFactor = setupTwoFactor;
exports.updatePreferences = updatePreferences;
exports.updateProfile = updateProfile;
exports.verifyRegistrationKey = verifyRegistrationKey;
exports.viewProfile = viewProfile;
