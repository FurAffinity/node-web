'use strict';

const Promise = require('bluebird');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

const readFileAsync = Promise.promisify(fs.readFile);
const unlinkAsync = Promise.promisify(fs.unlink);

const config = require('../config');
const identify = require('./identify').identify;

const TEMPORARY_NAME_SIZE = 18;
const FILE_HASH_SIZE = 16;
const MODE_OWNER_READ = 0o400;

function DisplayFile(hash, type) {
	if (typeof hash !== 'string') {
		throw new TypeError('File hash should be a string');
	}

	if (typeof type !== 'string') {
		throw new TypeError('File type should be a string');
	}

	this.hash = hash;
	this.type = type;
}

DisplayFile.from = function (hash, type) {
	return hash === null ?
		null :
		new DisplayFile(hash, type);
};

DisplayFile.serialize = function (displayFile) {
	return displayFile === null ?
		'' :
		displayFile.hash + ':' + displayFile.type;
};

DisplayFile.deserialize = function (s) {
	if (s === '') {
		return null;
	}

	const i = s.indexOf(':');
	const hash = s.substring(0, i);
	const type = s.substring(i + 1);

	return new DisplayFile(hash, type);
};

function getSelectFileQuery(digest) {
	return {
		name: 'select_file',
		text: 'SELECT id FROM files WHERE hash = $1',
		values: [digest],
	};
}

function getInsertFileQuery(digest, byteSize) {
	return {
		name: 'insert_file',
		text: 'INSERT INTO files (hash, size) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
		values: [digest, byteSize],
	};
}

function getStoragePath(digest) {
	return path.join(config.files.storage_root, digest.toString('hex'));
}

function toPathSafeBase64(buffer) {
	return (
		buffer.toString('base64')
			.replace(/=+$/, '')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
	);
}

function getTemporaryPath() {
	const randomName = toPathSafeBase64(crypto.randomBytes(TEMPORARY_NAME_SIZE));
	return path.join(config.files.temporary_root, randomName);
}

function getTemporary() {
	return new Promise(function (resolve, reject) {
		const temporaryPath = getTemporaryPath();
		const temporaryStream = fs.createWriteStream(temporaryPath, {
			flags: 'wx',
			mode: MODE_OWNER_READ,
		});

		temporaryStream.on('error', reject);

		temporaryStream.on('open', function () {
			temporaryStream.removeListener('error', reject);

			resolve({
				path: temporaryPath,
				stream: temporaryStream,
			});
		});
	})
		.disposer(function (temporary) {
			unlinkAsync(temporary.path);
		});
}

function insertObject(context, digest, byteSize, writer) {
	const storagePath = getStoragePath(digest);

	function useTransaction(client) {
		return client.query(getInsertFileQuery(digest, byteSize))
			.then(function (result) {
				if (result.rows.length !== 1) {
					return client.query(getSelectFileQuery(digest))
						.then(function (result) {
							return {
								id: result.rows[0].id,
								digest: digest,
							};
						});
				}

				const fileId = result.rows[0].id;

				const storageStream = fs.createWriteStream(storagePath, {
					flags: 'wx',
					mode: MODE_OWNER_READ,
				});

				return new Promise(function (resolve, reject) {
					storageStream.on('error', reject);

					storageStream.on('finish', function () {
						resolve({
							id: fileId,
							digest: digest,
						});
					});

					storageStream.on('open', function () {
						writer(storageStream, function (error) {
							storageStream.end();
							unlinkAsync(storagePath);
							reject(error);
						});
					});
				});
			});
	}

	return context.database.withTransaction(useTransaction);
}

function insertFile(context, digest, byteSize, temporaryPath) {
	return insertObject(context, digest, byteSize, function (storageStream, errorCallback) {
		const temporaryStream = fs.createReadStream(temporaryPath);
		temporaryStream.on('error', errorCallback);
		temporaryStream.pipe(storageStream);
	});
}

function insertBuffer(context, buffer) {
	const digest =
		crypto.createHash('sha512')
			.update(buffer)
			.digest()
			.slice(0, FILE_HASH_SIZE);

	return insertObject(context, digest, buffer.length, function (storageStream) {
		storageStream.end(buffer);
	});
}

function storeUpload(context, uploadStream, generators) {
	return Promise.using(getTemporary(), function (temporary) {
		return new Promise(function (resolve, reject) {
			const hash = crypto.createHash('sha512');
			let byteSize = 0;

			temporary.stream.on('error', reject);

			function temporaryFileIdentified(fileType) {
				const digest = hash.read().slice(0, 16);
				const generator = generators[fileType.id];

				if (!generator) {
					return Promise.reject(new Error('Unexpected file type: ' + fileType.id));
				}

				return (
					generator(context, {
						type: fileType.id,
						path: temporary.path,
						digest: digest,
						byteSize: byteSize,
					})
						.then(
							representations => ({
								representations: representations,
								submissionType: fileType.submissionType,
							})
						)
				);
			}

			temporary.stream.on('finish', function () {
				if (uploadStream.truncated) {
					reject(new Error('Size limit exceeded'));
					return;
				}

				resolve(
					identify(temporary.path)
						.then(temporaryFileIdentified)
				);
			});

			uploadStream.pipe(hash);
			uploadStream.pipe(temporary.stream);
			uploadStream.on('data', function (part) {
				byteSize += part.length;
			});

			uploadStream.on('limit', function () {
				uploadStream.unpipe(temporary.stream);
				temporary.stream.end();
			});
		});
	});
}

function storeUploadOrEmpty(context, uploadStream, generators) {
	return new Promise(function (resolve) {
		function endListener() {
			resolve(null);
		}

		function dataListener(data) {
			uploadStream.removeListener('data', dataListener);
			uploadStream.removeListener('end', endListener);

			const passthrough = new stream.PassThrough();

			passthrough.write(data);
			uploadStream.pipe(passthrough);

			resolve(storeUpload(context, passthrough, generators));
		}

		uploadStream.on('data', dataListener);
		uploadStream.on('end', endListener);
	});
}

function readFile(digest, encoding) {
	return readFileAsync(getStoragePath(digest), encoding);
}

exports.getTemporaryPath = getTemporaryPath;
exports.insertBuffer = insertBuffer;
exports.insertFile = insertFile;
exports.readFile = readFile;
exports.storeUpload = storeUpload;
exports.storeUploadOrEmpty = storeUploadOrEmpty;
