'use strict';

const _ = require('../utilities');

const duration = require('../duration');
const permissions = require('../permissions');
const rateLimit = require('../rate-limit');
const render = require('../render');
const submissions = require('../submissions');

const Ok = require('../respond').Ok;

const homeRoute = {
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

const userMenuRoute = {
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
