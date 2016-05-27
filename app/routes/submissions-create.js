"use strict";

var bluebird = require("bluebird");
var express = require("express");

var forms = require("../forms");
var permissions = require("../permissions");
var submissions = require("../submissions");
var wrap = require("./wrap").wrap;

var validRatings = new Set([
	"general",
	"mature",
	"adult",
]);

var get = wrap([
	permissions.submit.middleware,
	function (req, res, next) {
		bluebird.all([
			submissions.getPendingSubmissions(req.user.id),
			submissions.getFolders(req.user.id),
		])
			.spread(function (pendingSubmissions, folders) {
				res.render("upload.html", {
					pendingSubmissions: pendingSubmissions,
					folders: folders,
				});
			})
			.catch(next)
			.done();
	},
]);

var post = wrap([
	permissions.submit.middleware,
	forms.getReader({
		name: "submissions",
		fields: {
			id: forms.one,
			title: forms.one,
			description: forms.one,
			tags: forms.one,
			folders: forms.many,
			"new-folder": forms.one,
			rating: forms.one,
		},
	}),
	function (req, res, next) {
		var form = req.form;

		if (!(form.id = form.id >>> 0)) {
			form.addError("A submission must include a file");
		}

		if (!form.title) {
			form.addError("A title is required", "title");
		}

		if (!validRatings.has(form.rating)) {
			form.addError("A rating is required", "rating");
		}

		if (!form.valid) {
			res.locals.form = form;
			res.status(422);
			get(req, res, next);
			return;
		}

		var f = [];

		for (var i = 0; i < form.folders.length; i++) {
			var idString = form.folders[i];
			var id = idString >>> 0;

			if (String(id) !== idString) {
				res.status(400).send("Invalid form data");
				return;
			}

			f.push(id);
		}

		if (f[f.length - 1] === 0) {
			f[f.length - 1] = submissions.createFolder(req.user.id, form["new-folder"]);
		}

		bluebird.all(f)
			.then(function (folders) {
				form.folders = folders;
				return submissions.createSubmission(req.user.id, form);
			}).done(
				function () {
					res.redirect("/submissions/" + form.id);
				},
				next
			);
	},
]);

var router = new express.Router();

router.get("/submissions/new", get);
router.post("/submissions/", post);

exports.router = router;
