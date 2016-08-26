'use strict';

var bluebird = require('bluebird');

var errors = require('./errors');
var files = require('./files');
var types = require('./files/types');

var DisplayFile = files.DisplayFile;

var guestViewer = {
	id: null,
	ratingPreference: 'general',
};

function SubmissionNotFoundError() {
	errors.ApplicationError.call(this, 'Submission not found');
}

errors.ApplicationError.extend(SubmissionNotFoundError);

function getSelectPendingSubmissionsQuery(userId) {
	return {
		name: 'select_pending_submissions',
		text: `
			SELECT
				submissions.id, submissions.type, title, description, rating,
				tf.hash AS thumbnail_hash, thumbnail_type,
				submission_files.type AS file_type, sf.size AS file_size
			FROM submissions
				LEFT JOIN files tf ON submissions.thumbnail = tf.id
				LEFT JOIN submission_files ON submissions.id = submission_files.submission AND submission_files.original
				LEFT JOIN files sf ON submission_files.file = sf.id
			WHERE owner = $1 AND NOT published
			ORDER BY id DESC
		`,
		values: [userId],
	};
}

function getPublishSubmissionQuery(userId, submissionInfo) {
	return {
		name: 'insert_submission',
		text: 'UPDATE submissions SET title = $3, description = $4, rating = $5, published = TRUE WHERE id = $2 AND owner = $1',
		values: [userId, submissionInfo.id, submissionInfo.title, submissionInfo.description, submissionInfo.rating],
	};
}

function getCreatePendingSubmissionQuery(submissionInfo) {
	return {
		name: 'create_pending_submission',
		text: "INSERT INTO submissions (owner, type, title, description, thumbnail, thumbnail_type, waveform) VALUES ($1, $2, $3, '', $4, $5, $6) RETURNING id",
		values: [submissionInfo.owner, submissionInfo.type, submissionInfo.title, submissionInfo.thumbnail, submissionInfo.thumbnailType, submissionInfo.waveform],
	};
}

function getAssociateTagsQuery(submissionId, tagNames) {
	return {
		name: 'associate_tags',
		text: 'WITH t AS (INSERT INTO tags (name) SELECT name FROM UNNEST ($2::TEXT[]) AS name ON CONFLICT (name) DO UPDATE SET name = tags.name RETURNING $1::INTEGER, id) INSERT INTO submission_tags (submission, tag) SELECT * FROM t',
		values: [submissionId, tagNames],
	};
}

function getAssociateFilesQuery(submissionId, submissionFiles) {
	return {
		name: 'associate_files',
		text: `
			INSERT INTO submission_files (submission, type, file, original)
				SELECT $1, type, file, original
					FROM UNNEST (
						$2::file_type[],
						$3::INTEGER[],
						$4::BOOLEAN[]
					) AS t (type, file, original)
		`,
		values: [
			submissionId,
			submissionFiles.map(f => f.type),
			submissionFiles.map(f => f.id),
			submissionFiles.map(f => f.original),
		],
	};
}

function getCreateFolderQuery(userId, title) {
	return {
		name: 'create_folder',
		text: 'INSERT INTO folders (owner, title, "order") VALUES ($1, $2, (SELECT COALESCE(MAX("order"), 0) + 1 FROM folders WHERE owner = $1)) RETURNING id',
		values: [userId, title],
	};
}

function getSelectFoldersQuery(userId) {
	return {
		name: 'select_folders',
		text: `
			SELECT
				folders.id, folders.title, folders.hidden,
				CASE WHEN COUNT(submissions.id) = 0 THEN
					'[]'
				ELSE
					json_agg(json_build_object(
						'title', submissions.title,
						'thumbnail_hash', files.hash,
						'thumbnail_type', submissions.thumbnail_type
					) ORDER BY submissions.id)
				END AS submissions
			FROM folders
				LEFT JOIN submission_folders ON folders.id = submission_folders.folder
				LEFT JOIN submissions ON submission_folders.submission = submissions.id
				LEFT JOIN files ON submissions.thumbnail = files.id
			WHERE folders.owner = $1
			GROUP BY folders.id
			ORDER BY folders."order"
		`,
		values: [userId],
	};
}

function getAssociateFoldersQuery(submissionId, userId, folders) {
	return {
		name: 'associate_folders',
		text: 'INSERT INTO submission_folders (submission, folder, "order") SELECT $1, f, COALESCE(MAX(submission_folders.order), 0) + 1 FROM UNNEST ($3::INTEGER[]) AS f INNER JOIN folders ON f = folders.id LEFT JOIN submission_folders ON f = submission_folders.folder WHERE folders.owner = $2 GROUP BY f',
		values: [submissionId, userId, folders],
	};
}

function getViewSubmissionQuery(submissionId) {
	return {
		name: 'view_submission',
		text: `
			SELECT
				owner, users.display_username AS owner_name, user_files.hash AS owner_image_hash, users.image_type AS owner_image_type,
				submissions.type, submissions.title, submissions.description, submissions.rating, submissions.views,
				files.hash AS waveform_hash, submissions.created,
				CASE WHEN COUNT(tags.name) = 0 THEN
					'[]'
				ELSE
					json_agg(tags.name ORDER BY tags.name)
				END AS tags
			FROM submissions
				INNER JOIN users ON submissions.owner = users.id
				LEFT JOIN submission_tags ON submissions.id = submission_tags.submission
				LEFT JOIN tags ON submission_tags.tag = tags.id
				LEFT JOIN files ON submissions.waveform = files.id
				LEFT JOIN files user_files ON users.image = user_files.id
			WHERE submissions.id = $1 AND submissions.published
			GROUP BY submissions.id, users.id, files.id, user_files.id
		`,
		values: [submissionId],
	};
}

function getSelectSubmissionFilesQuery(submissionId) {
	return {
		name: 'select_submission_files',
		text: 'SELECT submission_files.type, files.hash FROM submission_files INNER JOIN files ON submission_files.file = files.id WHERE submission_files.submission = $1',
		values: [submissionId],
	};
}

function getSelectCommentsQuery(submissionId) {
	return {
		name: 'select_comments',
		text: `
			SELECT
				comments.id, comments.parent, comments.owner, comments.text, comments.created,
				users.display_username, files.hash AS owner_image_hash, users.image_type AS owner_image_type
			FROM comments
				INNER JOIN users ON comments.owner = users.id
				LEFT JOIN files ON users.image = files.id
			WHERE submission = $1
			ORDER BY id
		`,
		values: [submissionId],
	};
}

function getInsertCommentQuery(submissionId, userId, text) {
	return {
		name: 'insert_comment',
		text: 'INSERT INTO comments (submission, parent, owner, text) VALUES ($1, NULL, $2, $3) RETURNING id',
		values: [submissionId, userId, text],
	};
}

function getInsertReplyQuery(submissionId, parentId, userId, text) {
	return {
		name: 'insert_reply',
		text: 'INSERT INTO comments (submission, parent, owner, text) VALUES ($1, (SELECT id FROM comments WHERE id = $2 AND submission = $1), $3, $4) RETURNING id',
		values: [submissionId, parentId, userId, text],
	};
}

function getSelectRecentSubmissionsQuery(viewer) {
	return {
		name: 'select_recent_submissions',
		text: `
			SELECT
				submissions.id, submissions.title, submissions.rating, files.hash AS thumbnail_hash, submissions.thumbnail_type
			FROM submissions
				LEFT JOIN files ON submissions.thumbnail = files.id
				LEFT JOIN hidden_submissions ON submissions.id = hidden_submissions.submission AND hidden_submissions.hidden_by = $1
			WHERE
				submissions.published AND
				submissions.rating <= $2
			GROUP BY submissions.id, files.id
			HAVING COUNT(hidden_submissions.submission) = 0
			ORDER BY id DESC
			LIMIT 20
		`,
		values: [viewer.id, viewer.ratingPreference],
	};
}

function getHideSubmissionQuery(viewerId, submissionId) {
	return {
		name: 'hide_submission',
		text: 'INSERT INTO hidden_submissions (hidden_by, submission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
		values: [viewerId, submissionId],
	};
}

function getUnhideSubmissionQuery(viewerId, submissionId) {
	return {
		name: 'unhide_submission',
		text: 'DELETE FROM hidden_submissions WHERE hidden_by = $1 AND submission = $2',
		values: [viewerId, submissionId],
	};
}

function getSelectRecentUserSubmissionsQuery(viewer, userId) {
	return {
		name: 'select_recent_user_submissions',
		text: `
			SELECT
				submissions.id, submissions.title, submissions.rating, files.hash AS thumbnail_hash, submissions.thumbnail_type
			FROM submissions
				LEFT JOIN files ON submissions.thumbnail = files.id
				LEFT JOIN hidden_submissions ON submissions.id = hidden_submissions.submission AND hidden_submissions.hidden_by = $1
			WHERE
				submissions.published AND
				submissions.owner = $2 AND
				submissions.rating <= $3
			GROUP BY submissions.id, files.id
			HAVING COUNT(hidden_submissions.submission) = 0
			ORDER BY id DESC
			LIMIT 11
		`,
		values: [viewer.id, userId, viewer.ratingPreference],
	};
}

function normalizeTagName(tagName) {
	return (
		tagName
			.trim()
			.toLowerCase()
			.normalize('NFC')
	);
}

function uniqueTags(tagNames) {
	return Array.from(new Set(tagNames));
}

function parseTags(tagString) {
	return uniqueTags(
		tagString.split(',')
			.map(normalizeTagName)
			.filter(Boolean)
	);
}

function createSubmission(context, userId, submissionInfo) {
	function useTransaction(client) {
		return client.query(getPublishSubmissionQuery(userId, submissionInfo))
			.then(function (result) {
				if (result.rowCount !== 1) {
					return bluebird.reject(new Error('Submission does not exist or is not owned by the user'));
				}

				return bluebird.resolve();
			})
			.tap(function () {
				var tags = parseTags(submissionInfo.tags);

				return bluebird.all([
					client.query(getAssociateTagsQuery(submissionInfo.id, tags)),
					client.query(getAssociateFoldersQuery(submissionInfo.id, userId, submissionInfo.folders)),
				]);
			});
	}

	return context.database.withTransaction(useTransaction);
}

function createFolder(context, userId, folderName) {
	return (
		context.database.query(getCreateFolderQuery(userId, folderName))
			.then(function (result) {
				return result.rows[0].id;
			})
	);
}

function getFolders(context, userId) {
	return (
		context.database.query(getSelectFoldersQuery(userId))
			.then(function (result) {
				return result.rows.map(function (row) {
					return {
						id: row.id,
						title: row.title,
						hidden: row.hidden,
						submissions: row.submissions.map(function (submission) {
							return {
								title: submission.title,
								thumbnail: DisplayFile.from(
									submission.thumbnail_hash,
									submission.thumbnail_type
								),
							};
						}),
					};
				});
			})
	);
}

function viewSubmission(context, submissionId) {
	return bluebird.all([
		context.database.query(getViewSubmissionQuery(submissionId))
			.then(function (result) {
				if (result.rows.length !== 1) {
					return bluebird.reject(new SubmissionNotFoundError());
				}

				return result.rows[0];
			}),
		context.database.query(getSelectSubmissionFilesQuery(submissionId))
			.then(function (result) {
				return bluebird.map(
					result.rows,
					function (row) {
						if (row.type === 'html') {
							return files.readFile(row.hash, 'utf8')
								.then(function (contents) {
									row.contents = contents;
									return row;
								});
						} else {
							return row;
						}
					}
				);
			}),
		context.database.query(getSelectCommentsQuery(submissionId))
			.then(function (result) {
				var comments = [];
				var commentLookup = new Map();

				result.rows.forEach(function (row) {
					var newComment = {
						id: row.id,
						author: {
							id: row.owner,
							displayUsername: row.display_username,
							image: DisplayFile.from(
								row.owner_image_hash,
								row.owner_image_type
							),
						},
						text: row.text,
						children: [],
						created: row.created,
					};

					if (row.parent === null) {
						comments.push(newComment);
					} else if (commentLookup.has(row.parent)) {
						var parent = commentLookup.get(row.parent);
						parent.children.push(newComment);
					} else {
						return;
					}

					commentLookup.set(row.id, newComment);
				});

				return comments;
			}),
	]).spread(function (submissionRow, submissionFiles, comments) {
		return {
			id: submissionId,
			type: submissionRow.type,
			title: submissionRow.title,
			description: submissionRow.description,
			rating: submissionRow.rating,
			views: submissionRow.views,
			waveformHash: submissionRow.waveform_hash,
			created: submissionRow.created,
			owner: {
				id: submissionRow.owner,
				displayUsername: submissionRow.owner_name,
				image: DisplayFile.from(
					submissionRow.owner_image_hash,
					submissionRow.owner_image_type
				),
			},
			tags: submissionRow.tags,
			files: submissionFiles,
			comments: comments,
		};
	});
}

function createComment(context, submissionId, parentId, userId, text) {
	var query =
		parentId === null ?
			getInsertCommentQuery(submissionId, userId, text) :
			getInsertReplyQuery(submissionId, parentId, userId, text);

	return context.database.query(query)
		.then(function (result) {
			return result.rows[0].id;
		});
}

function getRecentSubmissions(context, viewer) {
	return context.database.query(getSelectRecentSubmissionsQuery(viewer || guestViewer))
		.then(function (result) {
			return result.rows.map(function (row) {
				return {
					id: row.id,
					title: row.title,
					rating: row.rating,
					thumbnail: DisplayFile.from(
						row.thumbnail_hash,
						row.thumbnail_type
					),
				};
			});
		});
}

function getPendingSubmissions(context, userId) {
	return context.database.query(getSelectPendingSubmissionsQuery(userId))
		.then(function (result) {
			return result.rows.map(function (row) {
				return {
					id: row.id,
					type: row.type,
					title: row.title,
					description: row.description,
					rating: row.rating,
					thumbnail: DisplayFile.from(
						row.thumbnail_hash,
						row.thumbnail_type
					),
					fileType: row.file_type,
					fileSize: row.file_size,
				};
			});
		});
}

function createPendingSubmission(context, userId, submissionFiles) {
	var original = submissionFiles.submission.find(f => f.original);

	function useTransaction(client) {
		return (
			client.query(
				getCreatePendingSubmissionQuery({
					owner: userId,
					type: types.byId(original.type).submissionType,
					title: submissionFiles.filename,
					thumbnail: submissionFiles.thumbnail && submissionFiles.thumbnail.id,
					thumbnailType: submissionFiles.thumbnail && submissionFiles.thumbnail.type,
					waveform: submissionFiles.waveform && submissionFiles.waveform.id,
				})
			)
				.then(function (result) {
					return result.rows[0].id;
				})
				.tap(function (submissionId) {
					return client.query(
						getAssociateFilesQuery(
							submissionId,
							submissionFiles.submission
						)
					);
				})
		);
	}

	return context.database.withTransaction(useTransaction);
}

function hideSubmission(context, viewerId, submissionId) {
	return context.database.query(getHideSubmissionQuery(viewerId, submissionId));
}

function unhideSubmission(context, viewerId, submissionId) {
	return context.database.query(getUnhideSubmissionQuery(viewerId, submissionId));
}

function getRecentUserSubmissions(context, viewer, userId) {
	return context.database.query(getSelectRecentUserSubmissionsQuery(viewer || guestViewer, userId))
		.then(function (result) {
			return result.rows;
		});
}

exports.createSubmission = createSubmission;
exports.viewSubmission = viewSubmission;
exports.getRecentSubmissions = getRecentSubmissions;
exports.getRecentUserSubmissions = getRecentUserSubmissions;

exports.hideSubmission = hideSubmission;
exports.unhideSubmission = unhideSubmission;

exports.createFolder = createFolder;
exports.getFolders = getFolders;

exports.createPendingSubmission = createPendingSubmission;
exports.getPendingSubmissions = getPendingSubmissions;

exports.createComment = createComment;
