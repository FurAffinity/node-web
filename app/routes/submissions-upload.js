'use strict';

const bluebird = require('bluebird');
const express = require('express');

const ApplicationError = require('../errors').ApplicationError;
const files = require('../files');
const forms = require('../forms');
const generators = require('../files/generators');
const permissions = require('../permissions');
const submissions = require('../submissions');
const wrap = require('./wrap').wrap;

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

const post = wrap([
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

const router = new express.Router();

router.post('/api/submissions/upload', post);

exports.router = router;
