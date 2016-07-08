'use strict';

var express = require('express');

var r = String.raw;

var submissions = require('../submissions');

var router = new express.Router();

router.get(r`/submissions/:id(\d+)`, function (req, res, next) {
	var submissionId = req.params.id | 0;

	submissions.viewSubmission(submissionId).done(
		function (submission) {
			res.render('submission.html', {
				submission: submission,
			});
		},
		next
	);
});

exports.router = router;
