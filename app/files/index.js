"use strict";

var bluebird = require("bluebird");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var stream = require("stream");

var readFileAsync = bluebird.promisify(fs.readFile);
var unlinkAsync = bluebird.promisify(fs.unlink);

var config = require("../config");
var database = require("../database");
var identify = require("./identify").identify;

var MODE_OWNER_READ_WRITE = parseInt("0600", 8);

function getSelectFileQuery(hexDigest) {
	return {
		name: "select_file",
		text: "SELECT id FROM files WHERE hash = $1",
		values: [hexDigest],
	};
}

function getInsertFileQuery(hexDigest, byteSize) {
	return {
		name: "insert_file",
		text: "INSERT INTO files (hash, size) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
		values: [hexDigest, byteSize],
	};
}

function getStoragePath(hexDigest) {
	return path.join(config.files.storage_root, hexDigest);
}

function toPathSafeBase64(buffer) {
	return (
		buffer.toString("base64")
			.replace(/=+$/, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
	);
}

function getTemporaryPath() {
	var randomName = toPathSafeBase64(crypto.randomBytes(config.files.temporary_name_size));
	return path.join(config.files.temporary_root, randomName);
}

function getTemporary() {
	return new bluebird.Promise(function (resolve, reject) {
		var temporaryPath = getTemporaryPath();
		var temporaryStream = fs.createWriteStream(temporaryPath, {
			flags: "wx",
			mode: MODE_OWNER_READ_WRITE,
		});

		temporaryStream.on("error", reject);

		temporaryStream.on("open", function () {
			temporaryStream.removeListener("error", reject);

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

function getFileInfo(filePath) {
	return new bluebird.Promise(function (resolve, reject) {
		var byteSize = 0;
		var hash = crypto.createHash("sha256");
		var readStream = fs.createReadStream(filePath);

		hash.on("data", function (digest) {
			resolve({
				digest: digest,
				byteSize: byteSize,
			});
		});

		readStream.on("error", reject);

		readStream.on("data", function (part) {
			byteSize += part.length;
		});

		readStream.pipe(hash);
	});
}

function insertObject(hexDigest, byteSize, writer) {
	var storagePath = getStoragePath(hexDigest);

	function useTransaction(client) {
		return client.query(getInsertFileQuery(hexDigest, byteSize))
			.then(function (result) {
				if (result.rows.length !== 1) {
					return client.query(getSelectFileQuery(hexDigest))
						.then(function (result) {
							return {
								id: result.rows[0].id,
								hexDigest: hexDigest,
							};
						});
				}

				var fileId = result.rows[0].id;

				var storageStream = fs.createWriteStream(storagePath, {
					flags: "wx",
					mode: MODE_OWNER_READ_WRITE,
				});

				return new bluebird.Promise(function (resolve, reject) {
					storageStream.on("error", reject);

					storageStream.on("finish", function () {
						resolve({
							id: fileId,
							hexDigest: hexDigest,
						});
					});

					storageStream.on("open", function () {
						writer(storageStream, function (error) {
							storageStream.end();
							unlinkAsync(storagePath);
							reject(error);
						});
					});
				});
			});
	}

	return database.withTransaction(useTransaction);
}

function insertFile(hexDigest, byteSize, temporaryPath) {
	return insertObject(hexDigest, byteSize, function (storageStream, errorCallback) {
		var temporaryStream = fs.createReadStream(temporaryPath);
		temporaryStream.on("error", errorCallback);
		temporaryStream.pipe(storageStream);
	});
}

function insertBuffer(buffer) {
	var hexDigest =
		crypto.createHash("sha256")
			.update(buffer)
			.digest("hex");

	return insertObject(hexDigest, buffer.length, function (storageStream) {
		storageStream.end(buffer);
	});
}

function getOriginalGenerator(hexDigest, byteSize) {
	return function (originalPath, originalType) {
		return insertFile(hexDigest, byteSize, originalPath).tap(function (file) {
			file.type = originalType;
			file.role = "submission";
			file.original = true;
		});
	};
}

function storeUpload(uploadStream, typeGenerators) {
	return bluebird.using(getTemporary(), function (temporary) {
		return new bluebird.Promise(function (resolve, reject) {
			var hash = crypto.createHash("sha256");
			var byteSize = 0;

			temporary.stream.on("error", reject);

			function temporaryFileIdentified(fileType) {
				var hexDigest = hash.read().toString("hex");

				if (!typeGenerators.hasOwnProperty(fileType.id)) {
					return bluebird.reject(new Error("Unexpected file type: " + fileType.id));
				}

				var generators =
					[getOriginalGenerator(hexDigest, byteSize)]
						.concat(typeGenerators[fileType.id]);

				return (
					bluebird.map(generators, function (generator) {
						return generator(temporary.path, fileType.id);
					})
						.then(function (generatedFiles) {
							var result = {
								submission: [],
								thumbnail: null,
								waveform: null,
							};

							generatedFiles.forEach(function (generatedFile) {
								if (generatedFile.role === "submission") {
									if (!("original" in generatedFile)) {
										generatedFile.original = false;
									}

									result.submission.push(generatedFile);
								} else {
									result[generatedFile.role] = generatedFile;
								}
							});

							return result;
						})
				);
			}

			temporary.stream.on("finish", function () {
				if (uploadStream.truncated) {
					reject(new Error("Size limit exceeded"));
					return;
				}

				resolve(
					identify(temporary.path)
						.then(temporaryFileIdentified)
				);
			});

			uploadStream.pipe(hash);
			uploadStream.pipe(temporary.stream);
			uploadStream.on("data", function (part) {
				byteSize += part.length;
			});

			uploadStream.on("limit", function () {
				uploadStream.unpipe(temporary.stream);
				temporary.stream.end();
			});
		});
	});
}

function storeUploadOrEmpty(uploadStream, typeGenerators) {
	return new bluebird.Promise(function (resolve) {
		function endListener() {
			resolve(null);
		}

		function dataListener(data) {
			uploadStream.removeListener("data", dataListener);
			uploadStream.removeListener("end", endListener);

			var passthrough = new stream.PassThrough();

			passthrough.write(data);
			uploadStream.pipe(passthrough);

			resolve(storeUpload(passthrough, typeGenerators));
		}

		uploadStream.on("data", dataListener);
		uploadStream.on("end", endListener);
	});
}

function readFile(hexDigest, encoding) {
	return readFileAsync(getStoragePath(hexDigest), encoding);
}

exports.getTemporaryPath = getTemporaryPath;
exports.getFileInfo = getFileInfo;
exports.insertBuffer = insertBuffer;
exports.insertFile = insertFile;
exports.readFile = readFile;
exports.storeUpload = storeUpload;
exports.storeUploadOrEmpty = storeUploadOrEmpty;
