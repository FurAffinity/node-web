'use strict';

var SECOND = 1000;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var MONTH = 30 * DAY;
var YEAR = 365 * DAY;

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

function formatLocalTime(hours, minutes) {
	var displayHours = hours % 12 || 12;

	return displayHours + ':' + padZero2(minutes) + (hours >= 12 ? ' PM' : ' AM');
}

function formatTimezone(timezoneOffset) {
	var absoluteOffset = Math.abs(timezoneOffset);
	var hours = absoluteOffset / 60 | 0;
	var minutes = absoluteOffset % 60;
	var sign = timezoneOffset < 0 ? '−' : '+';

	return sign + padZero2(hours) + padZero2(minutes);
}

function local(date) {
	var month = MONTH_NAMES[date.getMonth()];
	var day = withOrdinalSuffix(date.getDate());
	var year = date.getFullYear();
	var time = formatLocalTime(date.getHours(), date.getMinutes());
	var timezone = formatTimezone(-date.getTimezoneOffset());

	return month + ' ' + day + ', ' + year + ' at ' + time + ' ' + timezone;
}

function utc(date) {
	var month = MONTH_NAMES[date.getUTCMonth()];
	var day = withOrdinalSuffix(date.getUTCDate());
	var year = date.getUTCFullYear();
	var time = padZero2(date.getUTCHours()) + ':' + padZero2(date.getUTCMinutes()) + ':' + padZero2(date.getUTCSeconds());

	return month + ' ' + day + ', ' + year + ' at ' + time + ' UTC';
}

function relative(date) {
	var time = new Date() - date;
	var value;
	var unit;

	if (time >= YEAR) {
		value = time / YEAR | 0;
		unit = 'year';
	} else if (time >= MONTH) {
		value = time / MONTH | 0;
		unit = 'month';
	} else if (time >= DAY) {
		value = time / DAY | 0;
		unit = 'day';

		if (value === 1) {
			return 'yesterday';
		}
	} else if (time >= HOUR) {
		value = time / HOUR | 0;
		unit = 'hour';
	} else if (time >= MINUTE) {
		value = time / MINUTE | 0;
		unit = 'minute';
	} else if (time >= SECOND) {
		value = time / SECOND | 0;
		unit = 'second';
	} else {
		return 'just now';
	}

	return value + ' ' + (value === 1 ? unit : unit + 's') + ' ago';
}

exports.local = local;
exports.relative = relative;
exports.utc = utc;
