'use strict';

var bluebird = require('bluebird');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var errors = require('./errors');
var log = require('./log');

var Duration = require('./duration').Duration;
var redisClient = require('./redis').client;

var script = fs.readFileSync(path.join(__dirname, '../redis/rate-limit.lua'), 'utf8');
var scriptHash =
	crypto.createHash('sha1')
		.update(script)
		.digest('hex');

var scriptReload = log.defineEvent({
	name: 'rate-limit script reload',
	tags: ['rare'],
});

function RateError(counterName) {
	errors.ApplicationError.call(this, 'Rate limit exceeded: ' + counterName);
}

errors.ApplicationError.extend(RateError);

function RateLimit(name, limit, duration) {
	if (!(duration instanceof Duration)) {
		throw new TypeError('duration should be an instance of Duration');
	}

	this.name = name;
	this.limit = limit;
	this.duration = duration.seconds;
}

RateLimit.prototype.attempt = function (identifier) {
	var counter = this;
	var key = 'rate:' + this.name + ':' + identifier;
	var now = Date.now() / 1000 | 0;

	return redisClient.evalshaAsync(scriptHash, 1, key, this.duration, this.limit, now)
		.catch(function () {
			log.event(scriptReload);
			return redisClient.evalAsync(script, 1, key, counter.duration, counter.limit, now);
		})
		.then(function (result) {
			return result === 1 ?
				bluebird.resolve() :
				bluebird.reject(new RateError(counter.name));
		});
};

function byAddress(name, limit, duration) {
	var counter = new RateLimit(name, limit, duration);

	return function middleware(req, res, next) {
		counter.attempt(req.forwarded.for)
			.asCallback(next);
	};
}

exports.RateLimit = RateLimit;
exports.byAddress = byAddress;
