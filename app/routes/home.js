'use strict';

var _ = require('../utilities');

var duration = require('../duration');
var permissions = require('../permissions');
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
		return submissions.getRecentSubmissions(request.context, request.user)
			.then(function (recentSubmissions) {
				return new Ok({ recentSubmissions: recentSubmissions });
			});
	},
};

var userMenuRoute = {
	path: '/user-menu',
	middleware: [
		permissions.user.middleware,
	],
	renderers: [
		new NunjucksRenderer('user-menu.html'),
	],
	get: _.const(new Ok()),
};

exports.routes = [
	homeRoute,
	userMenuRoute,
];
