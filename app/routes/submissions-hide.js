'use strict';

var express = require('express');

var r = String.raw;

var forms = require('../forms');
var submissions = require('../submissions');

var hideFormReader = forms.getReader({ name: 'hide', fields: [] });
var router = new express.Router();

router.post(r`/api/submissions/:id(\d+)/hide`, hideFormReader, function (req, res, next) {
	if (req.user === null) {
		res
			.type('text/plain')
			.status(401) // TODO
			.send('Guests can’t hide submissions.');
		return;
	}

	var submissionId = req.params.id | 0;

	submissions.hideSubmission(req.user.id, submissionId).done(
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

	var submissionId = req.params.id | 0;

	submissions.unhideSubmission(req.user.id, submissionId).done(
		function () {
			res.send('Submission unhidden.');
		},
		next
	);
});

exports.router = router;
