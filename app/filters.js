'use strict';

const bbcode = require('../bbcode');
const nunjucks = require('nunjucks');

const ht = require('./html');
const dateFormat = require('./date-format');
const types = require('./files/types');
const users = require('./users');

const SIZE_KB = 1000;
const SIZE_MB = 1000 * SIZE_KB;

const DEFAULT_PATHS = {
	profile: '/images/default-profile.gif',
	thumbnail: '/images/default-thumbnail.svg',
};

function toPrecision2(n) {
	if (n >= 10) {
		return Math.round(n).toString();
	} else {
		return n.toFixed(1);
	}
}

function formatFileSize(bytes) {
	if (bytes >= SIZE_MB) {
		return toPrecision2(bytes / SIZE_MB) + ' MB';
	} else if (bytes >= SIZE_KB) {
		return toPrecision2(bytes / SIZE_KB) + ' KB';
	} else if (bytes === 1) {
		return '1 byte';
	} else {
		return bytes + ' bytes';
	}
}

function filePath(file, role) {
	return file == null ?
		DEFAULT_PATHS[role] :
		'/files/' + file.hash + '.' + types.byId(file.type).extension;
}

function relativeDateFilter(date) {
	const datetime = date.toISOString();
	const long = dateFormat.utc(date);
	const relative = dateFormat.relative(date);

	return new nunjucks.runtime.SafeString(`<time datetime="${datetime}" title="${long}">${relative}</time>`);
}

function renderBBCode(text) {
	const html = bbcode.render(text, { automaticParagraphs: true });
	return new nunjucks.runtime.SafeString(html);
}

function renderBBCodeWithExcerpt(input, maximumExcerptLength) {
	const html = bbcode.render(input, { automaticParagraphs: true });
	const excerpt = ht.getExcerpt(html, maximumExcerptLength);

	return {
		excerpt: new nunjucks.runtime.SafeString(excerpt),
		full: html === excerpt ? null : new nunjucks.runtime.SafeString(html),
	};
}

function userPath(user) {
	return '/users/' + user.id + '/' + users.getCanonicalUsername(user.displayUsername);
}

function cleanHtml(html) {
	return new nunjucks.runtime.SafeString(ht.clean(html));
}

exports.bbcode = renderBBCode;
exports.bbcodeWithExcerpt = renderBBCodeWithExcerpt;
exports.cleanHtml = cleanHtml;
exports.filePath = filePath;
exports.formatFileSize = formatFileSize;
exports.relativeDate = relativeDateFilter;
exports.userPath = userPath;
