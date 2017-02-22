'use strict';

const tap = require('tap');

const ht = require('../app/html');

tap.test('Safe HTML should be retained', function (t) {
	t.equal(
		ht.clean('plain text'),
		'plain text'
	);

	t.equal(
		ht.clean('<em>safe</em> formatting'),
		'<em>safe</em> formatting'
	);

	t.equal(
		ht.clean('safe<br>void tags'),
		'safe<br>void tags'
	);

	t.equal(
		ht.clean('<SpAN>mixed-case tags</sPan>'),
		'<span>mixed-case tags</span>'
	);

	t.end();
});

tap.test('Unsafe HTML should be removed', function (t) {
	t.equal(
		ht.clean('<script>alert(1)</script>'),
		'alert(1)'
	);

	t.equal(
		ht.clean('<a href="javascript:alert(1)">link</a>'),
		'<a>link</a>'
	);

	t.equal(
		ht.clean('<span i="unknown attribute">test</span>'),
		'<span>test</span>'
	);

	t.end();
});

tap.test('Characters should be encoded and decoded as appropriate', function (t) {
	t.equal(
		ht.clean("'\"&<>"),
		"'\"&amp;&lt;&gt;"
	);

	t.end();
});

tap.test('Bad nesting shouldn’t leak out', function (t) {
	t.equal(
		ht.clean('<b>unclosed'),
		'<b>unclosed</b>'
	);

	t.equal(
		ht.clean('<b><i>badly nested</b></i>'),
		'<b><i>badly nested</i></b>'
	);

	t.equal(
		ht.clean('too closed</b>'),
		'too closed'
	);

	t.end();
});

tap.test('Safe external links should be assigned rel="external nofollow"', function (t) {
	t.equal(
		ht.clean('<a href="https://example.com/">safe link</a>'),
		'<a href="https://example.com/" rel="external nofollow">safe link</a>'
	);

	t.equal(
		ht.clean('<a href="//example.com/">safe link</a>'),
		'<a href="//example.com/" rel="external nofollow">safe link</a>'
	);

	t.equal(
		ht.clean('<a href="https://furaffinity.net.example.com/">safe link</a>'),
		'<a href="https://furaffinity.net.example.com/" rel="external nofollow">safe link</a>'
	);

	t.end();
});

tap.test('Safe internal links should be retained', function (t) {
	t.equal(
		ht.clean('<a href="https://furaffinity.net/help">safe link</a>'),
		'<a href="https://furaffinity.net/help">safe link</a>'
	);

	t.equal(
		ht.clean('<a href="//www.furaffinity.net/help">safe link</a>'),
		'<a href="//www.furaffinity.net/help">safe link</a>'
	);

	t.equal(
		ht.clean('<a href="/help">safe link</a>'),
		'<a href="/help">safe link</a>'
	);

	t.end();
});
