'use strict';

var bluebird = require('bluebird');
var express = require('express');

var ApplicationError = require('../errors').ApplicationError;
var files = require('../files');
var forms = require('../forms');
var permissions = require('../permissions');
var submissions = require('../submissions');
var types = require('../files/types');
var wrap = require('./wrap').wrap;

function readFile(stream, filename) {
	return files.storeUpload(stream, types.submissionGenerators)
		.tap(function (submissionFiles) {
			submissionFiles.filename = filename;
		})
		.catch(function (error) {
			if (!(error instanceof ApplicationError)) {
				return bluebird.reject(error);
			}

			return {
				error: error.message,
			};
		});
}

var post = wrap([
	permissions.submit.middleware,
	forms.getReader({
		name: 'upload',
		fields: {
			file: forms.manyFiles(readFile),
		},
	}),
	function (req, res, next) {
		console.log(req.form.file);

		bluebird.map(
			req.form.file,
			function (submissionFiles) {
				if (submissionFiles.error) {
					return submissionFiles;
				}

				var thumbnail = submissionFiles.thumbnail;
				var original = submissionFiles.submission.find(f => f.original);

				return (
					submissions.createPendingSubmission(req.user.id, submissionFiles)
						.then(function (submissionId) {
							return {
								id: submissionId,
								thumbnail: thumbnail && (thumbnail.hexDigest + '.' + thumbnail.type),
								upload_type: original.type,
							};
						})
				);
			}
		).done(
			function (pendingSubmissions) {
				res.send(pendingSubmissions);
			},
			next
		);
	},
]);

var router = new express.Router();

router.post('/api/submissions/upload', post);

exports.router = router;
