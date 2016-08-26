'use strict';

var bbcode = require('../bbcode');
var nunjucks = require('nunjucks');

var ht = require('./html');
var dateFormat = require('./date-format');
var users = require('./users');

var SIZE_KB = 1000;
var SIZE_MB = 1000 * SIZE_KB;

var DEFAULT_PATHS = {
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
	return file === null ?
		DEFAULT_PATHS[role] :
		'/files/' + file.hash + '.' + file.type;
}

function relativeDateFilter(date) {
	var datetime = date.toISOString();
	var long = dateFormat.utc(date);
	var relative = dateFormat.relative(date);

	return new nunjucks.runtime.SafeString(`<time datetime="${datetime}" title="${long}">${relative}</time>`);
}

function renderBBCode(text) {
	var html = bbcode.render(text, { automaticParagraphs: true });
	return new nunjucks.runtime.SafeString(html);
}

function renderBBCodeWithExcerpt(input, maximumExcerptLength) {
	var html = bbcode.render(input, { automaticParagraphs: true });
	var excerpt = ht.getExcerpt(html, maximumExcerptLength);

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
