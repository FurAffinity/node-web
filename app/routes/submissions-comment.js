"use strict";

var express = require("express");

var r = String.raw;

var forms = require("../forms");
var submissions = require("../submissions");

var router = new express.Router();

router.post(r`/submissions/:id(\d+)/comments/`,
	forms.getReader({
		name: "comment",
		fields: {
			parent: forms.one,
			text: forms.one,
		},
	}),
	function (req, res, next) {
		var form = req.form;

		form.parent = form.parent >>> 0;

		if (!form.text) {
			res.status(422);
			next(new Error("A comment is required"));
			return;
		}

		var submissionId = req.params.id | 0;

		submissions.createComment(submissionId, form.parent, req.user.id, form.text).done(
			function (commentId) {
				res.redirect("/submissions/" + submissionId + "#comment-" + commentId);
			},
			next
		);
	}
);

exports.router = router;
