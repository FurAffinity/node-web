"use strict";

var bluebird = require("bluebird");
var fs = require("fs");
var sharp = require("sharp");

var spawn = require("child_process").spawn;
var unlinkAsync = bluebird.promisify(fs.unlink);

var files = require("./");

var PROFILE_IMAGE_PIXEL_LIMIT = 8000 * 8000;
var BANNER_PIXEL_LIMIT = 8000 * 8000;
var SUBMISSION_PIXEL_LIMIT = 8000 * 8000;

function createProfileImage(originalPath, originalType) {
	return sharp(originalPath)
		.limitInputPixels(PROFILE_IMAGE_PIXEL_LIMIT)
		.rotate()
		.resize(200, 200, { interpolator: "nohalo" })
		.withoutEnlargement()
		.crop(sharp.strategy.entropy)
		.compressionLevel(9)
		.quality(100)
		.trellisQuantisation()
		.optimiseScans()
		.toBuffer()
		.then(files.insertBuffer)
		.tap(function (file) {
			file.type = originalType;
			file.role = "profileImage";
		});
}

function createBanner(originalPath, originalType) {
	return sharp(originalPath)
		.metadata()
		.then(function (metadata) {
			var width;
			var height;

			if (metadata.orientation >= 5) {
				width = metadata.height;
				height = metadata.width;
			} else {
				width = metadata.width;
				height = metadata.height;
			}

			var resizeWidth = Math.min(width, 3840);
			var resizeHeight = Math.min(height, 910);

			return sharp(originalPath)
				.limitInputPixels(BANNER_PIXEL_LIMIT)
				.rotate()
				.resize(resizeWidth, resizeHeight, { interpolator: "nohalo" })
				.withoutEnlargement()
				.crop()
				.compressionLevel(9)
				.quality(100)
				.trellisQuantisation()
				.optimiseScans()
				.toBuffer()
				.then(files.insertBuffer)
				.tap(function (file) {
					file.type = originalType;
					file.role = "banner";
				});
		});
}

function createThumbnail(originalPath, originalType) {
	return sharp(originalPath)
		.limitInputPixels(SUBMISSION_PIXEL_LIMIT)
		.rotate()
		.resize(200, 200, { interpolator: "nohalo" })
		.max()
		.withoutEnlargement()
		.compressionLevel(9)
		.quality(100)
		.trellisQuantisation()
		.optimiseScans()
		.toBuffer()
		.then(files.insertBuffer)
		.tap(function (file) {
			file.type = originalType;
			file.role = "thumbnail";
		});
}

function createWaveform(originalPath) {
	return new bluebird.Promise(function (resolve, reject) {
		var temporaryPath = files.getTemporaryPath();

		var waveformProcess = spawn("fa-waveform", [originalPath, temporaryPath], {
			stdio: "ignore",
		});

		function insertFile() {
			return files.getFileInfo(temporaryPath)
				.then(function (fileInfo) {
					var hexDigest = fileInfo.digest.toString("hex");
					return files.insertFile(hexDigest, fileInfo.byteSize, temporaryPath);
				})
				.tap(function (file) {
					file.role = "waveform";
				});
		}

		function closeListener(exitCode) {
			var insertion =
				exitCode === 0 ?
					insertFile() :
					bluebird.reject(new Error("fa-waveform exited with code " + exitCode));

			resolve(
				insertion.finally(function () {
					unlinkAsync(temporaryPath);
				})
			);
		}

		function errorListener(error) {
			waveformProcess.removeListener("close", closeListener);
			reject(error);
		}

		waveformProcess.on("error", errorListener);
		waveformProcess.on("close", closeListener);
	});
}

function createOgg(originalPath) {
	return new bluebird.Promise(function (resolve, reject) {
		var temporaryPath = files.getTemporaryPath();

		var transcodeProcess = spawn("ffmpeg", ["-nostdin", "-timelimit", "300", "-i", originalPath, "-vn", "-f", "ogg", temporaryPath], {
			stdio: "ignore",
		});

		function insertFile() {
			return files.getFileInfo(temporaryPath)
				.then(function (fileInfo) {
					var hexDigest = fileInfo.digest.toString("hex");
					return files.insertFile(hexDigest, fileInfo.byteSize, temporaryPath);
				})
				.tap(function (file) {
					file.type = "ogg";
					file.role = "submission";
				});
		}

		function closeListener(exitCode) {
			var insertion =
				exitCode === 0 ?
					insertFile() :
					bluebird.reject(new Error("ffmpeg exited with code " + exitCode));

			resolve(
				insertion.finally(function () {
					unlinkAsync(temporaryPath);
				})
			);
		}

		function errorListener(error) {
			transcodeProcess.removeListener("close", closeListener);
			reject(error);
		}

		transcodeProcess.on("error", errorListener);
		transcodeProcess.on("close", closeListener);
	});
}

function createHtml(originalPath, originalType) {
	var pandocProcess = spawn("pandoc", ["-f", originalType, "-t", "html", originalPath], {
		stdio: ["ignore", "pipe", "ignore"],
	});

	return new bluebird.Promise(function (resolve, reject) {
		var parts = [];

		function closeListener(exitCode) {
			if (exitCode !== 0) {
				reject(new Error("pandoc exited with code " + exitCode));
				return;
			}

			resolve(
				files.insertBuffer(Buffer.concat(parts)).tap(function (file) {
					file.type = "html";
					file.role = "submission";
				})
			);
		}

		function errorListener(error) {
			pandocProcess.removeListener("close", closeListener);
			reject(error);
		}

		pandocProcess.on("error", errorListener);
		pandocProcess.on("close", closeListener);

		pandocProcess.stdout.on("data", function (part) {
			parts.push(part);
		});
	});
}

exports.banner = createBanner;
exports.profileImage = createProfileImage;
exports.thumbnail = createThumbnail;
exports.ogg = createOgg;
exports.waveform = createWaveform;
exports.html = createHtml;
