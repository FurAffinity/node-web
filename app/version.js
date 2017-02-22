'use strict';

const bluebird = require('bluebird');
const spawn = require('child_process').spawn;

function getGitRevision() {
	const gitProcess = spawn('git', ['rev-parse', 'HEAD'], {
		stdio: ['ignore', 'pipe', 'ignore'],
	});

	return new bluebird.Promise(function (resolve, reject) {
		const parts = [];

		function closeListener(exitCode) {
			if (exitCode !== 0) {
				reject(new Error('git exited with code ' + exitCode));
				return;
			}

			resolve(Buffer.concat(parts).toString('utf8').trim());
		}

		function errorListener(error) {
			gitProcess.removeListener('close', closeListener);
			reject(error);
		}

		gitProcess.on('error', errorListener);
		gitProcess.on('close', closeListener);

		gitProcess.stdout.on('data', function (part) {
			parts.push(part);
		});
	});
}

exports.getGitRevision = getGitRevision;
