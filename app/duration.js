'use strict';

function Duration(seconds) {
	this.seconds = seconds;
}

exports.Duration = Duration;

exports.seconds = function (n) {
	return new Duration(n);
};

exports.minutes = function (n) {
	return new Duration(60 * n);
};

exports.hours = function (n) {
	return new Duration(3600 * n);
};

exports.days = function (n) {
	return new Duration(86400 * n);
};
