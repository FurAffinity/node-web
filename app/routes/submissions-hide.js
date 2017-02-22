'use strict';

const express = require('express');

const r = String.raw;

const forms = require('../forms');
const submissions = require('../submissions');

const hideFormReader = forms.getReader({ name: 'hide', fields: [] });
const router = new express.Router();

router.post(r`/api/submissions/:id(\d+)/hide`, hideFormReader, function (req, res, next) {
	if (req.user === null) {
		res
			.type('text/plain')
			.status(401) // TODO
			.send('Guests can’t hide submissions.');
		return;
	}

	const submissionId = req.params.id | 0;

	submissions.hideSubmission(req.context, req.user.id, submissionId).done(
		function () {
			res.send('Submission hidden.');
		},
		next
	);
});

router.post(r`/api/submissions/:id(\d+)/unhide`, hideFormReader, function (req, res, next) {
	if (req.user === null) {
		res
			.type('text/plain')
			.status(401) // TODO
			.send('Guests can’t hide submissions.');
		return;
	}

	const submissionId = req.params.id | 0;

	submissions.unhideSubmission(req.context, req.user.id, submissionId).done(
		function () {
			res.send('Submission unhidden.');
		},
		next
	);
});

exports.router = router;
