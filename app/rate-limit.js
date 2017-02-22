'use strict';

const bluebird = require('bluebird');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const httpErrors = require('./http-errors');
const log = require('./log');

const Duration = require('./duration').Duration;

const script = fs.readFileSync(path.join(__dirname, '../redis/rate-limit.lua'), 'utf8');
const scriptHash =
	crypto.createHash('sha1')
		.update(script)
		.digest('hex');

const scriptReload = log.defineEvent({
	name: 'rate-limit script reload',
	tags: ['rare'],
});

class RateError extends httpErrors.TooManyRequestsError {
	constructor(counterName) {
		super('Rate limit exceeded: ' + counterName);
	}
}

httpErrors.TooManyRequestsError.extendClass(RateError);

class RateLimit {
	constructor(name, limit, duration) {
		if (!(duration instanceof Duration)) {
			throw new TypeError('duration should be an instance of Duration');
		}

		this.name = name;
		this.limit = limit;
		this.duration = duration.seconds;
	}

	attempt(context, identifier) {
		if (!config.rate_limits.enabled) {
			return bluebird.resolve();
		}

		const counter = this;
		const key = 'rate:' + this.name + ':' + identifier;
		const now = Date.now() / 1000 | 0;

		return context.redis.evalshaAsync(scriptHash, 1, key, this.duration, this.limit, now)
			.catch(() => {
				log.event(scriptReload);
				return context.redis.evalAsync(script, 1, key, counter.duration, counter.limit, now);
			})
			.then(result =>
				result === 1 ?
					bluebird.resolve() :
					bluebird.reject(new RateError(counter.name))
			);
	}
}

const byAddress = (name, limit, duration) => {
	const counter = new RateLimit(name, limit, duration);

	return (req, res, next) => {
		counter.attempt(req.context, req.forwarded.for)
			.asCallback(next);
	};
};

exports.RateLimit = RateLimit;
exports.byAddress = byAddress;
