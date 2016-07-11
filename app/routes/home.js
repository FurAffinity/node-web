'use strict';

var duration = require('../duration');
var rateLimit = require('../rate-limit');
var submissions = require('../submissions');

var NunjucksRenderer = require('../render').NunjucksRenderer;
var Ok = require('../respond').Ok;

var homeRoute = {
	path: '/',
	middleware: [
		rateLimit.byAddress('home', 5, duration.seconds(20)),
	],
	renderers: [
		new NunjucksRenderer('home.html'),
	],
	get: function (request) {
		return submissions.getRecentSubmissions(request.user)
			.then(function (recentSubmissions) {
				return new Ok({ recentSubmissions: recentSubmissions });
			});
	},
};

exports.routes = [
	homeRoute,
];
