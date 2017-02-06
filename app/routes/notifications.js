'use strict';

var bbcode = require('../../bbcode');
var html = require('../html');
var notifications = require('../notifications');
var permissions = require('../permissions');

var JSONRenderer = require('../render').JSONRenderer;
var Ok = require('../respond').Ok;

var notificationsRoute = {
	path: '/notifications',
	middleware: [
		permissions.user.middleware,
	],
	renderers: [
		new JSONRenderer(function (data) {
			data.notifications.forEach(function (notification) {
				var submission = notification.submission;

				if (submission) {
					var descriptionHtml = bbcode.render(submission.description, { automaticParagraphs: true });
					var excerpt = html.getExcerpt(descriptionHtml, 300);

					submission.description = {
						excerpt: excerpt,
						full: descriptionHtml,
					};
				}
			});

			return data;
		}),
	],
	get: function (request) {
		return notifications.getNotifications(request.context, request.user)
			.then(function (notifications) {
				return new Ok({ notifications: notifications });
			});
	},
};

exports.routes = [
	notificationsRoute,
];
