'use strict';

var express = require('express');

var duration = require('../duration');
var rateLimit = require('../rate-limit');
var submissions = require('../submissions');

var router = new express.Router();

router.get('/', rateLimit.byAddress('home', 5, duration.seconds(20)), function (req, res, next) {
	submissions.getRecentSubmissions(req.user).done(
		function (recentSubmissions) {
			res.render('home.html', { recentSubmissions: recentSubmissions });
		},
		next
	);
});

exports.router = router;
