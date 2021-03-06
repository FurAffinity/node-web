'use strict';

const bluebird = require('bluebird');

const errors = require('./errors');
const files = require('./files');

const DisplayFile = files.DisplayFile;

const guestViewer = {
	id: null,
	ratingPreference: 'general',
};

const keyByRole = representations => {
	const result = Object.create(null);

	for (let i = 0; i < representations.length; i++) {
		const rep = representations[i];

		if (rep.role in result) {
			result[rep.role].push(rep);
		} else {
			result[rep.role] = [rep];
		}
	}

	return result;
};

class SubmissionNotFoundError extends errors.ApplicationError {
	constructor() {
		super('Submission not found');
	}
}

errors.ApplicationError.extendClass(SubmissionNotFoundError);

const getSelectPendingSubmissionsQuery = userId =>
	({
		name: 'select_pending_submissions',
		text: `
			SELECT
				submissions.id, submissions.type, title, description, rating, metadata,
				jsonb_agg(
					jsonb_build_object(
						'role', representations.role,
						'type', representations.type,
						'hash', encode(files.hash, 'hex')
					)
				) AS representations
			FROM submissions
				LEFT JOIN representations ON submissions.id = representations.submission
				LEFT JOIN files ON representations.file = files.id
			WHERE owner = $1 AND visibility = 'draft'
			GROUP BY submissions.id
			ORDER BY submissions.id DESC
		`,
		values: [userId],
	});

const getPublishSubmissionQuery = (userId, submissionInfo) =>
	({
		name: 'insert_submission',
		text: "UPDATE submissions SET title = $3, description = $4, rating = $5, visibility = 'public' WHERE id = $2 AND owner = $1",
		values: [userId, submissionInfo.id, submissionInfo.title, submissionInfo.description, submissionInfo.rating],
	});

const getCreatePendingSubmissionQuery = submissionInfo =>
	({
		name: 'create_pending_submission',
		text: "INSERT INTO submissions (owner, type, title, description) VALUES ($1, $2, $3, '') RETURNING id",
		values: [submissionInfo.owner, submissionInfo.type, submissionInfo.title],
	});

const getAssociateTagsQuery = (submissionId, tagNames) =>
	({
		name: 'associate_tags',
		text: 'WITH t AS (INSERT INTO tags (name) SELECT name FROM UNNEST ($2::TEXT[]) AS name ON CONFLICT (name) DO UPDATE SET name = tags.name RETURNING $1::INTEGER, id) INSERT INTO submission_tags (submission, tag) SELECT * FROM t',
		values: [submissionId, tagNames],
	});

const getAssociateFilesQuery = (submissionId, representations) =>
	({
		name: 'associate_files',
		text: `
			INSERT INTO representations (submission, role, type, file)
				SELECT $1, role, type, file
					FROM UNNEST (
						$2::representation_role[],
						$3::representation_type[],
						$4::INTEGER[]
					) AS t (role, type, file)
		`,
		values: [
			submissionId,
			representations.map(r => r.role),
			representations.map(r => r.type),
			representations.map(r => r.file.id),
		],
	});

const getCreateFolderQuery = (userId, title) =>
	({
		name: 'create_folder',
		text: 'INSERT INTO folders (owner, title, "order") VALUES ($1, $2, (SELECT COALESCE(MAX("order"), 0) + 1 FROM folders WHERE owner = $1)) RETURNING id',
		values: [userId, title],
	});

const getSelectFoldersQuery = userId =>
	({
		name: 'select_folders',
		text: `
			SELECT
				id, title, hidden,
				coalesce(
					jsonb_agg(
						jsonb_build_object(
							'title', submission_title,
							'representations', representations
						)
						ORDER BY submission_id
					) FILTER (WHERE submission_id IS NOT NULL),
					'[]'
				) AS submissions
			FROM (
				SELECT
					folders.id, folders.title, folders.hidden, folders."order",
					submissions.id AS submission_id, submissions.title AS submission_title,
					jsonb_agg(
						jsonb_build_object(
							'role', representations.role,
							'type', representations.type,
							'hash', encode(files.hash, 'hex')
						)
					) AS representations
				FROM folders
					LEFT JOIN submission_folders ON folders.id = submission_folders.folder
					LEFT JOIN submissions ON submission_folders.submission = submissions.id
					LEFT JOIN representations ON submissions.id = representations.submission
					LEFT JOIN files ON representations.file = files.id
				WHERE folders.owner = $1
				GROUP BY folders.id, submissions.id
			) AS t
			GROUP BY id, title, hidden, "order"
			ORDER BY "order"
		`,
		values: [userId],
	});

const getAssociateFoldersQuery = (submissionId, userId, folders) =>
	({
		name: 'associate_folders',
		text: 'INSERT INTO submission_folders (submission, folder, "order") SELECT $1, f, COALESCE(MAX(submission_folders.order), 0) + 1 FROM UNNEST ($3::INTEGER[]) AS f INNER JOIN folders ON f = folders.id LEFT JOIN submission_folders ON f = submission_folders.folder WHERE folders.owner = $2 GROUP BY f',
		values: [submissionId, userId, folders],
	});

const getViewSubmissionQuery = submissionId =>
	({
		name: 'view_submission',
		text: `
			SELECT
				owner, users.display_username AS owner_name,
				submissions.type, submissions.title, submissions.description, submissions.rating, submissions.views, submissions.created,
				coalesce(json_agg(tags.name ORDER BY tags.name) FILTER (WHERE tags.name IS NOT NULL), '[]') AS tags,
				(
					SELECT
						jsonb_agg(
							jsonb_build_object(
								'role', representations.role,
								'type', representations.type,
								'hash', encode(files.hash, 'hex')
							)
						) AS representations
					FROM representations
						LEFT JOIN files ON representations.file = files.id
					WHERE submissions.id = representations.submission
				)
			FROM submissions
				INNER JOIN users ON submissions.owner = users.id
				LEFT JOIN submission_tags ON submissions.id = submission_tags.submission
				LEFT JOIN tags ON submission_tags.tag = tags.id
			WHERE submissions.id = $1 AND submissions.visibility = 'public'
			GROUP BY submissions.id, users.id
		`,
		values: [submissionId],
	});

const getSelectCommentsQuery = submissionId =>
	({
		name: 'select_comments',
		text: `
			SELECT
				comments.id, comments.parent, comments.owner, comments.text, comments.created,
				users.display_username,
				jsonb_agg(
					jsonb_build_object(
						'role', user_representations.role,
						'type', user_representations.type,
						'hash', encode(files.hash, 'hex')
					)
				) AS user_representations
			FROM comments
				INNER JOIN users ON comments.owner = users.id
				LEFT JOIN user_representations ON users.id = user_representations.user
				LEFT JOIN files ON user_representations.file = files.id
			WHERE submission = $1
			GROUP BY comments.id, users.id
			ORDER BY comments.id
		`,
		values: [submissionId],
	});

const getInsertCommentQuery = (submissionId, userId, text) =>
	({
		name: 'insert_comment',
		text: 'INSERT INTO comments (submission, parent, owner, text) VALUES ($1, NULL, $2, $3) RETURNING id',
		values: [submissionId, userId, text],
	});

const getInsertReplyQuery = (submissionId, parentId, userId, text) =>
	({
		name: 'insert_reply',
		text: 'INSERT INTO comments (submission, parent, owner, text) VALUES ($1, (SELECT id FROM comments WHERE id = $2 AND submission = $1), $3, $4) RETURNING id',
		values: [submissionId, parentId, userId, text],
	});

const getSelectRecentSubmissionsQuery = viewer =>
	({
		name: 'select_recent_submissions',
		text: `
			SELECT
				submissions.id, submissions.title, submissions.rating,
				jsonb_agg(
					jsonb_build_object(
						'role', representations.role,
						'type', representations.type,
						'hash', encode(files.hash, 'hex')
					)
				) AS representations
			FROM submissions
				LEFT JOIN representations ON submissions.id = representations.submission
				LEFT JOIN files ON representations.file = files.id
				LEFT JOIN hidden_submissions ON submissions.id = hidden_submissions.submission AND hidden_submissions.hidden_by = $1
			WHERE
				submissions.visibility = 'public' AND
				submissions.rating <= $2
			GROUP BY submissions.id, files.id
			HAVING COUNT(hidden_submissions.submission) = 0
			ORDER BY id DESC
			LIMIT 20
		`,
		values: [viewer.id, viewer.ratingPreference],
	});

const getHideSubmissionQuery = (viewerId, submissionId) =>
	({
		name: 'hide_submission',
		text: 'INSERT INTO hidden_submissions (hidden_by, submission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
		values: [viewerId, submissionId],
	});

const getUnhideSubmissionQuery = (viewerId, submissionId) =>
	({
		name: 'unhide_submission',
		text: 'DELETE FROM hidden_submissions WHERE hidden_by = $1 AND submission = $2',
		values: [viewerId, submissionId],
	});

const getSelectRecentUserSubmissionsQuery = (viewer, userId) =>
	({
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
	});

const normalizeTagName = tagName =>
	tagName
		.trim()
		.toLowerCase()
		.normalize('NFC');

const uniqueTags = tagNames =>
	Array.from(new Set(tagNames));

const parseTags = tagString =>
	uniqueTags(
		tagString.split(',')
			.map(normalizeTagName)
			.filter(Boolean)
	);

const createSubmission = (context, userId, submissionInfo) => {
	const useTransaction = client =>
		client.query(getPublishSubmissionQuery(userId, submissionInfo))
			.then(result => {
				if (result.rowCount !== 1) {
					return bluebird.reject(new Error('Submission does not exist or is not owned by the user'));
				}

				return bluebird.resolve();
			})
			.tap(() => {
				const tags = parseTags(submissionInfo.tags);

				return bluebird.all([
					client.query(getAssociateTagsQuery(submissionInfo.id, tags)),
					client.query(getAssociateFoldersQuery(submissionInfo.id, userId, submissionInfo.folders)),
				]);
			});

	return context.database.withTransaction(useTransaction);
};

const createFolder = (context, userId, folderName) =>
	context.database.query(getCreateFolderQuery(userId, folderName))
		.then(result => result.rows[0].id);

const getFolders = (context, userId) =>
	context.database.query(getSelectFoldersQuery(userId))
		.then(result =>
			result.rows.map(row =>
				({
					id: row.id,
					title: row.title,
					hidden: row.hidden,
					submissions: row.submissions.map(submission =>
						({
							title: submission.title,
							representations: submission.representations,
						})
					),
				})
			)
		);

const viewSubmission = (context, submissionId) =>
	bluebird.all([
		context.database.query(getViewSubmissionQuery(submissionId))
			.then(result => {
				if (result.rows.length !== 1) {
					return bluebird.reject(new SubmissionNotFoundError());
				}

				return result.rows[0];
			}),
		context.database.query(getSelectCommentsQuery(submissionId))
			.then(result => {
				const comments = [];
				const commentLookup = new Map();

				result.rows.forEach(row => {
					const newComment = {
						id: row.id,
						author: {
							id: row.owner,
							displayUsername: row.display_username,
							representations: keyByRole(row.user_representations),
						},
						text: row.text,
						children: [],
						created: row.created,
					};

					if (row.parent === null) {
						comments.push(newComment);
					} else if (commentLookup.has(row.parent)) {
						const parent = commentLookup.get(row.parent);
						parent.children.push(newComment);
					} else {
						return;
					}

					commentLookup.set(row.id, newComment);
				});

				return comments;
			}),
	]).spread((submissionRow, comments) =>
		({
			id: submissionId,
			type: submissionRow.type,
			title: submissionRow.title,
			description: submissionRow.description,
			rating: submissionRow.rating,
			views: submissionRow.views,
			created: submissionRow.created,
			owner: {
				id: submissionRow.owner,
				displayUsername: submissionRow.owner_name,
			},
			tags: submissionRow.tags,
			representations: keyByRole(submissionRow.representations),
			comments: comments,
		})
	);

const createComment = (context, submissionId, parentId, userId, text) => {
	const query =
		parentId === null ?
			getInsertCommentQuery(submissionId, userId, text) :
			getInsertReplyQuery(submissionId, parentId, userId, text);

	return context.database.query(query)
		.then(result => result.rows[0].id);
};

const getRecentSubmissions = (context, viewer) =>
	context.database.query(getSelectRecentSubmissionsQuery(viewer || guestViewer))
		.then(result =>
			result.rows.map(row =>
				({
					id: row.id,
					title: row.title,
					rating: row.rating,
					thumbnail: DisplayFile.from(
						row.thumbnail_hash,
						row.thumbnail_type
					),
				})
			)
		);

const getPendingSubmissions = (context, userId) =>
	context.database.query(getSelectPendingSubmissionsQuery(userId))
		.then(result =>
			result.rows.map(row =>
				({
					id: row.id,
					type: row.type,
					title: row.title,
					description: row.description,
					rating: row.rating,
					metadata: row.metadata,
					representations: keyByRole(row.representations),
				})
			)
		);

const createPendingSubmission = (context, userId, upload) => {
	const useTransaction = client =>
		client.query(
			getCreatePendingSubmissionQuery({
				owner: userId,
				type: upload.submissionType,
				title: upload.filename,
			})
		)
			.then(result => result.rows[0].id)
			.tap(submissionId =>
				client.query(
					getAssociateFilesQuery(
						submissionId,
						upload.representations
					)
				)
			);

	return context.database.withTransaction(useTransaction);
};

const hideSubmission = (context, viewerId, submissionId) =>
	context.database.query(getHideSubmissionQuery(viewerId, submissionId));

const unhideSubmission = (context, viewerId, submissionId) =>
	context.database.query(getUnhideSubmissionQuery(viewerId, submissionId));

const getRecentUserSubmissions = (context, viewer, userId) =>
	context.database.query(getSelectRecentUserSubmissionsQuery(viewer || guestViewer, userId))
		.then(result => result.rows);

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
