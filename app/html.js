'use strict';

const htmlparser = require('htmlparser2');
const url = require('url');

const voidTags = new Set([
	'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input',
	'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const tagWhitelist = new Set([
	'section', 'nav', 'article', 'aside',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'header', 'footer',
	'address',
	'p', 'hr', 'pre', 'blockquote', 'ol', 'ul', 'li', 'dl', 'dt', 'dd',
	'figure', 'figcaption', 'div',
	'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr',
	'data', 'time', 'code', 'var', 'samp', 'kbd', 'sub', 'sup',
	'i', 'b', 'u', 'mark',
	'ruby', 'rt', 'rp', 'bdi', 'bdo',
	'span', 'br', 'wbr',
	'ins', 'del',
	'table', 'caption', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th',
]);

const schemeWhitelist = new Set([
	null, 'http:', 'https:',
]);

const internalHostname = /(^|\.)furaffinity\.net$/i;

function escapeAttributeValue(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;');
}

function escapeContent(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function isSafeLink(uri) {
	return schemeWhitelist.has(uri.protocol);
}

function isInternalLink(uri) {
	return uri.hostname === null || internalHostname.test(uri.hostname);
}

function cleanAttribute(safeAttributes, tagName, name, value) {
	if (tagName === 'a' && name.toLowerCase() === 'href') {
		const parsed = url.parse(value, false, true);

		if (!isSafeLink(parsed)) {
			return;
		}

		safeAttributes.href = value;

		if (!isInternalLink(parsed)) {
			safeAttributes.rel = 'external nofollow';
		}
	}
}

function cleanAttributes(tagName, attributes) {
	const safeAttributes = {};

	Object.keys(attributes).forEach(function (name) {
		cleanAttribute(safeAttributes, tagName, name, attributes[name]);
	});

	return Object.keys(safeAttributes).map(function (name) {
		const value = safeAttributes[name];
		return ' ' + name + '="' + escapeAttributeValue(value) + '"';
	}).join('');
}

function clean(html) {
	let output = '';
	const open = [];

	function addOpenTag(name, attributes) {
		if (!tagWhitelist.has(name)) {
			return;
		}

		output += '<' + name + cleanAttributes(name, attributes) + '>';

		if (!voidTags.has(name)) {
			open.push(name);
		}
	}

	function addCloseTag(name) {
		if (open.lastIndexOf(name) === -1) {
			return;
		}

		let closed;

		do {
			closed = open.pop();
			output += '</' + closed + '>';
		} while (closed !== name);
	}

	function addText(text) {
		output += escapeContent(text);
	}

	const parser = new htmlparser.Parser(
		{
			onopentag: addOpenTag,
			onclosetag: addCloseTag,
			ontext: addText,
		},
		{
			decodeEntities: true,
		}
	);

	parser.parseComplete(html);

	for (let i = open.length - 1; i >= 0; i--) {
		output += '</' + open[i] + '>';
	}

	return output;
}

function getExcerpt(html, maximumLength) {
	let excerpt = '';
	let remainingLength = maximumLength;
	const openTags = [];

	const parser = new htmlparser.Parser({
		onopentag: function (name, attributes) {
			excerpt += '<' + name + Object.keys(attributes).map(function (attributeName) {
				return ' ' + attributeName + '="' + escapeAttributeValue(attributes[attributeName]) + '"';
			}).join('') + '>';

			if (!voidTags.has(name)) {
				openTags.push(name);
			}
		},
		ontext: function (text) {
			if (text.length > remainingLength) {
				excerpt += escapeContent(text.substring(0, remainingLength - 1)) + '…';
			} else if (text.length === remainingLength) {
				excerpt += escapeContent(text);
			} else {
				excerpt += escapeContent(text);
				remainingLength -= text.length;
				return;
			}

			for (let i = openTags.length - 1; i >= 0; i--) {
				excerpt += '</' + openTags[i] + '>';
			}

			parser.reset();
		},
		onclosetag: function (name) {
			if (!voidTags.has(name)) {
				excerpt += '</' + name + '>';
				openTags.pop();
			}

			if (name === 'p') {
				parser.reset();
			}
		},
	}, { decodeEntities: true });

	parser.write(html);
	parser.end();

	return excerpt;
}

exports.clean = clean;
exports.getExcerpt = getExcerpt;
