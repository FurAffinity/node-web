'use strict';

var _ = require('../utilities');

var duration = require('../duration');
var permissions = require('../permissions');
var rateLimit = require('../rate-limit');
var render = require('../render');
var submissions = require('../submissions');

var Ok = require('../respond').Ok;

var homeRoute = {
	path: '/',
	middleware: [
		rateLimit.byAddress('home', 5, duration.seconds(20)),
	],
	renderers: [
		new render.NunjucksRenderer('home.html'),
		new render.JSONRenderer(data => data),
	],
	get: request =>
		submissions.getRecentSubmissions(request.context, request.user)
			.then(recentSubmissions => new Ok({ recentSubmissions })),
};

var userMenuRoute = {
	path: '/user-menu',
	middleware: [
		permissions.user.middleware,
	],
	renderers: [
		new render.NunjucksRenderer('user-menu.html'),
	],
	get: _.const(new Ok()),
};

exports.routes = [
	homeRoute,
	userMenuRoute,
];
