'use strict';

const crypto = require('crypto');
const nunjucks = require('nunjucks');

const spawn = require('child_process').spawn;

const config = require('./config');

const templateLoader = new nunjucks.FileSystemLoader('templates/email');
const templateEnvironment = new nunjucks.Environment(templateLoader, {
	autoescape: false,
	throwOnUndefined: true,
});

templateEnvironment.addGlobal('site_root', config.site.root);

/*
 * Recognizes the non-obsolete parts of RFC 5322 as they pertain to single
 * e-mail addresses (no comments or folding whitespace). Unicode isn’t
 * supported yet.
 */
const DOT_ATOM = /^[\w!#$%&'*+\-/=?^`{|}~]+(\.[\w!#$%&'*+\-/=?^`{|}~]+)*$/;
const QUOTED_STRING = /^"(?:[\x21\x23-\x5b\x5d-\x7e]|\\[\t\x20-\x7e])*"$/;
const UNNECESSARY_QUOTED_PAIR = /\\([\x21\x23-\x5b\x5d-\x7e])/g;

function getCanonicalLocalPart(localPart) {
	if (DOT_ATOM.test(localPart)) {
		return localPart;
	}

	if (QUOTED_STRING.test(localPart)) {
		const necessaryPairsOnly = localPart.replace(UNNECESSARY_QUOTED_PAIR, '$1');
		const stripped = necessaryPairsOnly.slice(1, -1);

		if (DOT_ATOM.test(stripped)) {
			return stripped;
		}

		return necessaryPairsOnly;
	}

	return null;
}

function isValidDomainPart(domainPart) {
	// domain-literal explicitly not supported
	return DOT_ATOM.test(domainPart);
}

function getCanonicalAddress(address) {
	if (address.length > 254) {
		return null;
	}

	const i = address.lastIndexOf('@');

	if (i === -1) {
		return null;
	}

	const localPart = getCanonicalLocalPart(address.substring(0, i));
	const domainPart = address.substring(i + 1);

	if (localPart === null || !isValidDomainPart(domainPart)) {
		return null;
	}

	return localPart + '@' + domainPart.toLowerCase();
}

/*
 * Formats text as flowed. Doesn’t support quotation or space-stuffing. Might
 * produce lines longer than recommended (long stretches with no spaces) or
 * shorter than necessary (surrogate pairs, combining characters).
 *
 * We’re going to use exactly the same text for fixed, too – a decision that
 * requires no justification.
 */
function toFlowed(body) {
	let result = '';
	let lastBreak = 0;
	let lastBreakOption = -1;

	for (let i = 0; i < body.length; i++) {
		const c = body.charAt(i);

		if (c === '\n') {
			if (i - lastBreak < 79 || lastBreakOption === -1) {
				result += body.substring(lastBreak, i + 1);
			} else {
				result +=
					body.substring(lastBreak, lastBreakOption + 1) + '\n' +
					body.substring(lastBreakOption + 1, i + 1);

				lastBreakOption = -1;
			}

			lastBreak = i + 1;
			continue;
		}

		if (c !== ' ') {
			continue;
		}

		for (;;) {
			if (i - lastBreak < 79) {
				lastBreakOption = i;
				break;
			}

			if (lastBreakOption === -1) {
				result += body.substring(lastBreak, i + 1) + '\n';
				lastBreak = i + 1;
			} else {
				result += body.substring(lastBreak, lastBreakOption + 1) + '\n';
				lastBreak = lastBreakOption + 1;
				lastBreakOption = -1;
			}
		}
	}

	if (body.length - lastBreak > 79 && lastBreakOption !== -1) {
		result += body.substring(lastBreak, lastBreakOption + 1) + '\n';
		lastBreak = lastBreakOption + 1;
	}

	return result + body.substring(lastBreak);
}

function send(info, callback) {
	const hash = crypto.createHash('sha256');
	hash.update(info.body);

	const boundary = hash.digest().slice(0, 8).toString('hex');

	const flowedBody = toFlowed(info.body);

	const message =
		'To: ' + info.to + '\n' +
		'From: ' + info.from + '\n' +
		'Subject: ' + info.subject + '\n' +
		'Content-Type: multipart/alternative; boundary=' + boundary + '\n' +
		'\n--' + boundary + '\n' + 'Content-Type: text/plain; charset=utf-8\n' +
		'\n' + flowedBody + '\n' +
		'\n--' + boundary + '\n' + 'Content-Type: text/plain; charset=utf-8; format=flowed\n' +
		'\n' + flowedBody + '\n';

	const p = spawn('sendmail', ['-t']);

	function closeListener(code) {
		if (code === 0) {
			callback(null);
		} else {
			callback(new Error('sendmail exited with code ' + code));
		}
	}

	function errorListener(error) {
		callback(error);
		p.removeListener('close', closeListener);
	}

	p.on('error', errorListener);
	p.on('close', closeListener);

	p.stdin.end(message);
}

exports.templateEnvironment = templateEnvironment;
exports.getCanonicalAddress = getCanonicalAddress;
exports.toFlowed = toFlowed;
exports.send = send;
