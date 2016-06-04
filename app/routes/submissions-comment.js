"use strict";

var express = require("express");

var r = String.raw;

var forms = require("../forms");
var submissions = require("../submissions");

var commentFormReader = forms.getReader({
	name: "comment",
	fields: {
		text: forms.one,
	},
});

function createComment(req, res, next) {
	var form = req.form;

	if (!form.text) {
		res
			.status(422)
			.send("A comment is required");
		return;
	}

	var submissionId = req.params.submission | 0;
	var parentId =
		"comment" in req.params ?
			req.params.comment | 0 :
			null;

	submissions.createComment(submissionId, parentId, req.user.id, form.text).done(
		function (commentId) {
			res.redirect("/submissions/" + submissionId + "#comment-" + commentId);
		},
		next
	);
}

var router = new express.Router();

router.post(r`/submissions/:submission(\d+)/comments/`, commentFormReader, createComment);
router.post(r`/submissions/:submission(\d+)/comments/:comment(\d+)/reply`, commentFormReader, createComment);

exports.router = router;
