'use strict';

const Promise = require('bluebird');
const mmmagic = require('mmmagic');

const spawn = require('child_process').spawn;

const types = require('./types');

const magic = new mmmagic.Magic(mmmagic.MAGIC_MIME_TYPE);
const detectFileAsync = Promise.promisify(magic.detectFile, { context: magic });

function readProcess(path, argv) {
	return new Promise(function (resolve, reject) {
		const child = spawn(path, argv, {
			stdio: ['ignore', 'pipe', 'ignore'],
		});

		const outputParts = [];
		let outputLength = 0;

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
			const data = JSON.parse(output.toString('utf8'));

			for (let i = 0; i < data.streams.length; i++) {
				const stream = data.streams[i];

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
