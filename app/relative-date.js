'use strict';

var SECOND = 1000;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var MONTH = 30 * DAY;
var YEAR = 365 * DAY;

function relativeDate(date) {
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

exports.relativeDate = relativeDate;
