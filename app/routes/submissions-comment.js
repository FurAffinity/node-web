'use strict';

const express = require('express');

const r = String.raw;

const forms = require('../forms');
const submissions = require('../submissions');

const commentFormReader = forms.getReader({
	name: 'comment',
	fields: {
		text: forms.one,
	},
});

function createComment(req, res, next) {
	const form = req.form;

	if (!form.text) {
		res
			.status(422)
			.send('A comment is required');
		return;
	}

	const submissionId = req.params.submission | 0;
	const parentId =
		'comment' in req.params ?
			req.params.comment | 0 :
			null;

	submissions.createComment(req.context, submissionId, parentId, req.user.id, form.text).done(
		function (commentId) {
			res.redirect('/submissions/' + submissionId + '#comment-' + commentId);
		},
		next
	);
}

const router = new express.Router();

router.post(r`/submissions/:submission(\d+)/comments/`, commentFormReader, createComment);
router.post(r`/submissions/:submission(\d+)/comments/:comment(\d+)/reply`, commentFormReader, createComment);

exports.router = router;
