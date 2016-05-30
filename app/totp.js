"use strict";

var bluebird = require("bluebird");
var crypto = require("crypto");
var spawn = require("child_process").spawn;

var timingSafeCompare = require("./timing-safe-compare").timingSafeCompare;

var secretLength = 20;
var base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
	var i;
	var result = "";

	for (i = 0; i < buffer.length - 4; i += 5) {
		result += base32Alphabet.charAt(buffer[i] >> 3);
		result += base32Alphabet.charAt((buffer[i] & 7) << 2 | buffer[i + 1] >> 6);
		result += base32Alphabet.charAt((buffer[i + 1] & 63) >> 1);
		result += base32Alphabet.charAt((buffer[i + 1] & 1) << 4 | buffer[i + 2] >> 4);
		result += base32Alphabet.charAt((buffer[i + 2] & 15) << 1 | buffer[i + 3] >> 7);
		result += base32Alphabet.charAt((buffer[i + 3] & 127) >> 2);
		result += base32Alphabet.charAt((buffer[i + 3] & 3) << 3 | buffer[i + 4] >> 5);
		result += base32Alphabet.charAt(buffer[i + 4] & 31);
	}

	switch (buffer.length % 5) {
	case 4:
		result += base32Alphabet.charAt(buffer[i] >> 3);
		result += base32Alphabet.charAt((buffer[i] & 7) << 2 | buffer[i + 1] >> 6);
		result += base32Alphabet.charAt((buffer[i + 1] & 63) >> 1);
		result += base32Alphabet.charAt((buffer[i + 1] & 1) << 4 | buffer[i + 2] >> 4);
		result += base32Alphabet.charAt((buffer[i + 2] & 15) << 1 | buffer[i + 3] >> 7);
		result += base32Alphabet.charAt((buffer[i + 3] & 127) >> 2);
		result += base32Alphabet.charAt((buffer[i + 3] & 3) << 3);
		break;

	case 3:
		result += base32Alphabet.charAt(buffer[i] >> 3);
		result += base32Alphabet.charAt((buffer[i] & 7) << 2 | buffer[i + 1] >> 6);
		result += base32Alphabet.charAt((buffer[i + 1] & 63) >> 1);
		result += base32Alphabet.charAt((buffer[i + 1] & 1) << 4 | buffer[i + 2] >> 4);
		result += base32Alphabet.charAt((buffer[i + 2] & 15) << 1);
		break;

	case 2:
		result += base32Alphabet.charAt(buffer[i] >> 3);
		result += base32Alphabet.charAt((buffer[i] & 7) << 2 | buffer[i + 1] >> 6);
		result += base32Alphabet.charAt((buffer[i + 1] & 63) >> 1);
		result += base32Alphabet.charAt((buffer[i + 1] & 1) << 4);
		break;

	case 1:
		result += base32Alphabet.charAt(buffer[i] >> 3);
		result += base32Alphabet.charAt((buffer[i] & 7) << 2);
		break;
	}

	return result;
}

function dt(digest) {
	var offset = digest[19] & 0xf;
	return digest.readUInt32BE(offset) & 0x7fffffff;
}

function hotp(key, counter) {
	if (!Number.isSafeInteger(counter)) {
		throw new TypeError("counter must be a safe integer");
	}

	if (counter < 0) {
		throw new RangeError("counter must be a non-negative integer");
	}

	if (counter >= Math.pow(2, 48)) {
		throw new RangeError("counter must be less than 2^48");
	}

	var counterBuffer = Buffer.alloc(8);
	counterBuffer.writeUIntBE(counter, 2, 6);

	var digest =
		crypto.createHmac("sha1", key)
			.update(counterBuffer)
			.digest();

	return ("00000" + dt(digest)).slice(-6);
}

function getCodeCounter(key, code) {
	var counter = Math.floor(Date.now() / 30000);

	if (timingSafeCompare(hotp(key, counter), code)) {
		return counter;
	}

	if (timingSafeCompare(hotp(key, counter + 1), code)) {
		return counter + 1;
	}

	if (timingSafeCompare(hotp(key, counter - 1), code)) {
		return counter - 1;
	}

	return null;
}

function getBarcode(data) {
	var encodeProcess = spawn("qrencode", ["-o", "-"], {
		stdio: ["pipe", "pipe", "ignore"],
	});

	return new bluebird.Promise(function (resolve, reject) {
		var parts = [];

		function closeListener(exitCode) {
			if (exitCode !== 0) {
				reject(new Error("qrencode exited with code " + exitCode));
				return;
			}

			resolve(Buffer.concat(parts));
		}

		function errorListener(error) {
			encodeProcess.removeListener("close", closeListener);
			reject(error);
		}

		encodeProcess.on("error", errorListener);
		encodeProcess.on("close", closeListener);

		encodeProcess.stdout.on("data", function (part) {
			parts.push(part);
		});

		encodeProcess.stdin.end(data, "utf8");
	});
}

function getKeyBarcode(issuer, user, base32Key) {
	var barcodeData =
		"otpauth://totp/" + encodeURIComponent(issuer) + ":" + encodeURIComponent(user) +
		"?secret=" + base32Key + "&issuer=" + encodeURIComponent(issuer);

	return getBarcode(barcodeData).then(function (imageData) {
		return "data:image/png;base64," + imageData.toString("base64");
	});
}

function generateKey() {
	return crypto.randomBytes(secretLength);
}

exports.base32Encode = base32Encode;
exports.generateKey = generateKey;
exports.getKeyBarcode = getKeyBarcode;
exports.getCodeCounter = getCodeCounter;
exports.secretLength = secretLength;
