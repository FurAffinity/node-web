'use strict';

const express = require('express');

const r = String.raw;

const submissions = require('../submissions');

const router = new express.Router();

router.get(r`/submissions/:id(\d+)`, function (req, res, next) {
	const submissionId = req.params.id | 0;

	submissions.viewSubmission(req.context, submissionId).done(
		function (submission) {
			res.render('submission.html', {
				submission: submission,
			});
		},
		next
	);
});

exports.router = router;
