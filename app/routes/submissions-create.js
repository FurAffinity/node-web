'use strict';

const bluebird = require('bluebird');
const express = require('express');

const forms = require('../forms');
const permissions = require('../permissions');
const submissions = require('../submissions');
const wrap = require('./wrap').wrap;

const validRatings = new Set([
	'general',
	'mature',
	'adult',
]);

const get = wrap([
	permissions.submit.middleware,
	function (req, res, next) {
		bluebird.all([
			submissions.getPendingSubmissions(req.context, req.user.id),
			submissions.getFolders(req.context, req.user.id),
		])
			.spread(function (pendingSubmissions, folders) {
				res.render('upload.html', {
					pendingSubmissions: pendingSubmissions,
					folders: folders,
				});
			})
			.catch(next)
			.done();
	},
]);

const post = wrap([
	permissions.submit.middleware,
	forms.getReader({
		name: 'submissions',
		fields: {
			id: forms.one,
			title: forms.one,
			description: forms.one,
			tags: forms.one,
			folders: forms.many,
			'new-folder': forms.one,
			rating: forms.one,
		},
	}),
	function (req, res, next) {
		const form = req.form;

		if (!(form.id = form.id >>> 0)) {
			form.addError('A submission must include a file');
		}

		if (!form.title) {
			form.addError('A title is required', 'title');
		}

		if (!validRatings.has(form.rating)) {
			form.addError('A rating is required', 'rating');
		}

		if (!form.valid) {
			res.locals.form = form;
			res.status(422);
			get(req, res, next);
			return;
		}

		const f = [];

		for (let i = 0; i < form.folders.length; i++) {
			const idString = form.folders[i];
			const id = idString >>> 0;

			if (String(id) !== idString) {
				res.status(400).send('Invalid form data');
				return;
			}

			f.push(id);
		}

		if (f[f.length - 1] === 0) {
			f[f.length - 1] = submissions.createFolder(req.context, req.user.id, form['new-folder']);
		}

		bluebird.all(f)
			.then(function (folders) {
				form.folders = folders;
				return submissions.createSubmission(req.context, req.user.id, form);
			}).done(
				function () {
					res.redirect('/submissions/' + form.id);
				},
				next
			);
	},
]);

const router = new express.Router();

router.get('/submissions/new', get);
router.post('/submissions/', post);

exports.router = router;
