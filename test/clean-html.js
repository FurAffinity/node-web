"use strict";

var tap = require("tap");

var clean = require("../app/clean-html").clean;

tap.test("Safe HTML should be retained", function (t) {
	t.equal(
		clean("plain text"),
		"plain text"
	);

	t.equal(
		clean("<em>safe</em> formatting"),
		"<em>safe</em> formatting"
	);

	t.equal(
		clean("safe<br>void tags"),
		"safe<br>void tags"
	);

	t.equal(
		clean("<SpAN>mixed-case tags</sPan>"),
		"<span>mixed-case tags</span>"
	);

	t.end();
});

tap.test("Unsafe HTML should be removed", function (t) {
	t.equal(
		clean("<script>alert(1)</script>"),
		"alert(1)"
	);

	t.equal(
		clean('<a href="javascript:alert(1)">link</a>'),
		"<a>link</a>"
	);

	t.equal(
		clean('<span i="unknown attribute">test</span>'),
		"<span>test</span>"
	);

	t.end();
});

tap.test("Characters should be encoded and decoded as appropriate", function (t) {
	t.equal(
		clean("'\"&<>"),
		"'\"&amp;&lt;&gt;"
	);

	t.end();
});

tap.test("Bad nesting shouldn’t leak out", function (t) {
	t.equal(
		clean("<b>unclosed"),
		"<b>unclosed</b>"
	);

	t.equal(
		clean("<b><i>badly nested</b></i>"),
		"<b><i>badly nested</i></b>"
	);

	t.equal(
		clean("too closed</b>"),
		"too closed"
	);

	t.end();
});

tap.test('Safe external links should be assigned rel="external nofollow"', function (t) {
	t.equal(
		clean('<a href="https://example.com/">safe link</a>'),
		'<a href="https://example.com/" rel="external nofollow">safe link</a>'
	);

	t.equal(
		clean('<a href="//example.com/">safe link</a>'),
		'<a href="//example.com/" rel="external nofollow">safe link</a>'
	);

	t.end();
});

tap.test("Safe internal links should be retained", function (t) {
	t.equal(
		clean('<a href="https://furaffinity.net/help">safe link</a>'),
		'<a href="https://furaffinity.net/help">safe link</a>'
	);

	t.equal(
		clean('<a href="//www.furaffinity.net/help">safe link</a>'),
		'<a href="//www.furaffinity.net/help">safe link</a>'
	);

	t.equal(
		clean('<a href="/help">safe link</a>'),
		'<a href="/help">safe link</a>'
	);

	t.end();
});
