'use strict';

const bluebird = require('bluebird');
const express = require('express');

const r = String.raw;

const submissions = require('../submissions');
const users = require('../users');

const router = new express.Router();

router.get(r`/users/:id(\d+)/:username([\w.~-]+)`, function (req, res, next) {
	const profileId = req.params.id | 0;

	bluebird.all([
		users.viewProfile(req.context, profileId),
		users.getUserStatistics(req.context, profileId),
		submissions.getRecentUserSubmissions(req.context, req.user, profileId),
	])
		.spread(function (profile, statistics, recentSubmissions) {
			return {
				profile: profile,
				recentSubmissions: recentSubmissions,
				statistics: statistics,
			};
		})
		.done(
			function (templateData) {
				res.render('profile.html', templateData);
			},
			next
		);
});

exports.router = router;
