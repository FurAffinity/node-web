"use strict";

var bluebird = require("bluebird");
var express = require("express");

var r = String.raw;

var submissions = require("../submissions");
var users = require("../users");

var router = new express.Router();

router.get(r`/users/:id(\d+)/:username([\w.~-]+)`, function (req, res, next) {
	var profileId = req.params.id | 0;

	bluebird.all([
		users.viewProfile(profileId),
		users.getUserStatistics(profileId),
		submissions.getRecentUserSubmissions(req.user, profileId),
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
				res.render("profile.html", templateData);
			},
			next
		);
});

exports.router = router;
