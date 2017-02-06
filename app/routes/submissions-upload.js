'use strict';

var bluebird = require('bluebird');
var express = require('express');

var ApplicationError = require('../errors').ApplicationError;
var files = require('../files');
var forms = require('../forms');
var generators = require('../files/generators');
var permissions = require('../permissions');
var submissions = require('../submissions');
var wrap = require('./wrap').wrap;

function readFile(request, stream, filename) {
	return files.storeUpload(request.context, stream, generators.submissionGenerators)
		.tap(upload => {
			upload.filename = filename;
		})
		.catch(error => {
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
			upload =>
				submissions.createPendingSubmission(req.context, req.user.id, upload).then(
					submissionId => ({
						id: submissionId,
						representations: upload.representations,
					})
				)
		).done(
			pendingSubmissions => {
				res.send(pendingSubmissions);
			},
			next
		);
	},
]);

var router = new express.Router();

router.post('/api/submissions/upload', post);

exports.router = router;
