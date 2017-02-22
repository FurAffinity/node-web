'use strict';

const bbcode = require('../../bbcode');
const html = require('../html');
const notifications = require('../notifications');
const permissions = require('../permissions');

const JSONRenderer = require('../render').JSONRenderer;
const Ok = require('../respond').Ok;

const notificationsRoute = {
	path: '/notifications',
	middleware: [
		permissions.user.middleware,
	],
	renderers: [
		new JSONRenderer(function (data) {
			data.notifications.forEach(function (notification) {
				const submission = notification.submission;

				if (submission) {
					const descriptionHtml = bbcode.render(submission.description, { automaticParagraphs: true });
					const excerpt = html.getExcerpt(descriptionHtml, 300);

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
