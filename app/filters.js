'use strict';

var bbcode = require('../bbcode');
var nunjucks = require('nunjucks');

var ht = require('./html');
var relativeDate = require('./relative-date').relativeDate;
var users = require('./users');

var SIZE_KB = 1000;
var SIZE_MB = 1000 * SIZE_KB;

var MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

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

function getOrdinalSuffix(n) {
	if (n % 100 >= 10 && n % 100 < 20) {
		return 'th';
	}

	switch (n % 10) {
	case 1:
		return 'st';

	case 2:
		return 'nd';

	case 3:
		return 'rd';

	default:
		return 'th';
	}
}

function withOrdinalSuffix(n) {
	return n + getOrdinalSuffix(n);
}

function padZero2(n) {
	return n < 10 ? '0' + n : '' + n;
}

function relativeDateFilter(date) {
	var datetime = date.toISOString();
	var relative = relativeDate(date);
	var long = MONTH_NAMES[date.getUTCMonth()] + ' ' + withOrdinalSuffix(date.getUTCDate()) + ', ' + date.getUTCFullYear() + ' at ' + padZero2(date.getUTCHours()) + ':' + padZero2(date.getUTCMinutes()) + ':' + padZero2(date.getUTCSeconds()) + ' UTC';

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
