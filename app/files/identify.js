'use strict';

var Promise = require('bluebird');
var mmmagic = require('mmmagic');

var spawn = require('child_process').spawn;

var types = require('./types');

var magic = new mmmagic.Magic(mmmagic.MAGIC_MIME_TYPE);
var detectFileAsync = Promise.promisify(magic.detectFile, { context: magic });

function readProcess(path, argv) {
	return new Promise(function (resolve, reject) {
		var child = spawn(path, argv, {
			stdio: ['ignore', 'pipe', 'ignore'],
		});

		var outputParts = [];
		var outputLength = 0;

		function closeListener(exitCode) {
			resolve(
				exitCode === 0 ?
					Buffer.concat(outputParts, outputLength) :
					Promise.reject(new Error(path + ' exited with code ' + exitCode))
			);
		}

		function errorListener(error) {
			child.removeListener('close', closeListener);
			reject(error);
		}

		child.on('error', errorListener);
		child.on('close', closeListener);

		child.stdout.on('data', function (part) {
			outputParts.push(part);
			outputLength += part.length;
		});
	});
}

function identifyContainer(filePath) {
	return readProcess('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', filePath])
		.then(function (output) {
			var data = JSON.parse(output.toString('utf8'));

			for (var i = 0; i < data.streams.length; i++) {
				var stream = data.streams[i];

				switch (stream.codec_name) {
				case 'opus':
					return types.byId('opus');

				case 'vorbis':
					return types.byId('vorbis');
				}
			}

			return null;
		});
}

function identify(filePath) {
	return detectFileAsync(filePath)
		.then(function (mediaType) {
			if (mediaType === 'audio/ogg') {
				return identifyContainer(filePath);
			}

			return types.byMediaType(mediaType);
		});
}

exports.identify = identify;
