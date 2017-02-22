'use strict';

const crypto = require('crypto');
const COMPARISON_KEY = crypto.randomBytes(32);

function getComparisonDigest(buffer) {
	return crypto.createHmac('sha256', COMPARISON_KEY)
		.update(buffer)
		.digest();
}

function timingSafeCompare(a, b) {
	return getComparisonDigest(a)
		.equals(getComparisonDigest(b));
}

exports.timingSafeCompare = timingSafeCompare;
