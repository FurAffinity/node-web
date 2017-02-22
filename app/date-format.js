'use strict';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const MONTH_NAMES = [
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
	const displayHours = hours % 12 || 12;

	return displayHours + ':' + padZero2(minutes) + (hours >= 12 ? ' PM' : ' AM');
}

function formatTimezone(timezoneOffset) {
	const absoluteOffset = Math.abs(timezoneOffset);
	const hours = absoluteOffset / 60 | 0;
	const minutes = absoluteOffset % 60;
	const sign = timezoneOffset < 0 ? '−' : '+';

	return sign + padZero2(hours) + padZero2(minutes);
}

function local(date) {
	const month = MONTH_NAMES[date.getMonth()];
	const day = withOrdinalSuffix(date.getDate());
	const year = date.getFullYear();
	const time = formatLocalTime(date.getHours(), date.getMinutes());
	const timezone = formatTimezone(-date.getTimezoneOffset());

	return month + ' ' + day + ', ' + year + ' at ' + time + ' ' + timezone;
}

function utc(date) {
	const month = MONTH_NAMES[date.getUTCMonth()];
	const day = withOrdinalSuffix(date.getUTCDate());
	const year = date.getUTCFullYear();
	const time = padZero2(date.getUTCHours()) + ':' + padZero2(date.getUTCMinutes()) + ':' + padZero2(date.getUTCSeconds());

	return month + ' ' + day + ', ' + year + ' at ' + time + ' UTC';
}

function relative(date) {
	const time = new Date() - date;
	let value;
	let unit;

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
