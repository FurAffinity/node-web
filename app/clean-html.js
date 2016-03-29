"use strict";

var htmlparser = require("htmlparser2");
var url = require("url");

var voidTags = new Set([
	"area", "base", "br", "col", "command", "embed", "hr", "img", "input",
	"keygen", "link", "meta", "param", "source", "track", "wbr",
]);

var tagWhitelist = new Set([
	"section", "nav", "article", "aside",
	"h1", "h2", "h3", "h4", "h5", "h6",
	"header", "footer",
	"address",
	"p", "hr", "pre", "blockquote", "ol", "ul", "li", "dl", "dt", "dd",
	"figure", "figcaption", "div",
	"a", "em", "strong", "small", "s", "cite", "q", "dfn", "abbr",
	"data", "time", "code", "var", "samp", "kbd", "sub", "sup",
	"i", "b", "u", "mark",
	"ruby", "rt", "rp", "bdi", "bdo",
	"span", "br", "wbr",
	"ins", "del",
	"table", "caption", "tbody", "thead", "tfoot", "tr", "td", "th",
]);

var schemeWhitelist = new Set([
	null, "http:", "https:",
]);

var internalHostname = /(^|\.)furaffinity\.net/i;

function escapeAttributeValue(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;");
}

function escapeContent(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function isSafeLink(uri) {
	return schemeWhitelist.has(uri.protocol);
}

function isInternalLink(uri) {
	return uri.hostname === null || internalHostname.test(uri.hostname);
}

function cleanAttribute(safeAttributes, tagName, name, value) {
	if (tagName === "a" && name.toLowerCase() === "href") {
		var parsed = url.parse(value, false, true);

		if (!isSafeLink(parsed)) {
			return;
		}

		safeAttributes.href = value;

		if (!isInternalLink(parsed)) {
			safeAttributes.rel = "external nofollow";
		}
	}
}

function cleanAttributes(tagName, attributes) {
	var safeAttributes = {};

	Object.keys(attributes).forEach(function (name) {
		cleanAttribute(safeAttributes, tagName, name, attributes[name]);
	});

	return Object.keys(safeAttributes).map(function (name) {
		var value = safeAttributes[name];
		return " " + name + '="' + escapeAttributeValue(value) + '"';
	}).join("");
}

function clean(html) {
	var output = "";
	var open = [];

	function addOpenTag(name, attributes) {
		if (!tagWhitelist.has(name)) {
			return;
		}

		output += "<" + name + cleanAttributes(name, attributes) + ">";

		if (!voidTags.has(name)) {
			open.push(name);
		}
	}

	function addCloseTag(name) {
		if (open.lastIndexOf(name) === -1) {
			return;
		}

		var closed;

		do {
			closed = open.pop();
			output += "</" + closed + ">";
		} while (closed !== name);
	}

	function addText(text) {
		output += escapeContent(text);
	}

	var parser = new htmlparser.Parser(
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

	for (var i = open.length - 1; i >= 0; i--) {
		output += "</" + open[i] + ">";
	}

	return output;
}

exports.clean = clean;
