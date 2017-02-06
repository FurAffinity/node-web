'use strict';

var _ = require('./utilities');
var bluebird = require('bluebird');

function getSubmissionNotificationsQuery(user) {
	return {
		name: 'submission_notifications',
		text: `
			SELECT
				submissions.id, submissions.owner, users.display_username,
				submissions.title, submissions.description, submissions.rating,
				submissions.created, submissions.updated,
				jsonb_agg(
					jsonb_build_object(
						'role', representations.role,
						'type', representations.type,
						'hash', encode(files.hash, 'hex')
					)
				) AS representations
			FROM follows
				INNER JOIN submissions ON follows.following = submissions.owner
				INNER JOIN users ON submissions.owner = users.id
				LEFT JOIN representations ON submissions.id = representations.submission
				LEFT JOIN files ON representations.file = files.id
			WHERE follows.follower = $1
				AND submissions.visibility = 'public'
				AND submissions.rating <= $2
			GROUP BY submissions.id, users.display_username
			ORDER BY submissions.updated DESC
			LIMIT 100
		`,
		values: [user.id, user.ratingPreference],
	};
}

function getSubmissionNotifications(context, user) {
	return context.database.query(getSubmissionNotificationsQuery(user))
		.then(function (result) {
			return result.rows.map(function (row) {
				var updated = row.updated.getTime() !== row.created.getTime();

				return {
					type: updated ? 'submission-update' : 'submission',
					source: {
						id: row.owner,
						displayUsername: row.display_username,
					},
					submission: {
						id: row.id,
						title: row.title,
						description: row.description,
						rating: row.rating,
						representations: row.representations,
					},
					time: row.updated,
				};
			});
		});
}

function getNotifications(context, user) {
	return bluebird.all([
		getSubmissionNotifications(context, user),
	])
		.then(_.concat);
}

exports.getNotifications = getNotifications;
