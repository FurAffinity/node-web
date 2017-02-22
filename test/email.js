'use strict';

const tap = require('tap');

const email = require('../app/email');

function repeat(c, length) {
	return new Array(length + 1).join(c);
}

tap.test('toFlowed should produce 79-character lines when possible', function (t) {
	function unchanged(text) {
		t.equal(email.toFlowed(text), text);
	}

	t.equal(email.toFlowed('Hello, world!'), 'Hello, world!');

	t.equal(
		email.toFlowed('Iure tenetur odit consectetur nesciunt incidunt itaque. Et fugit adipisci nesciunt ut enim quam iste quos. Rerum quo nihil distinctio. Laboriosam natus eius deserunt iusto. Fuga praesentium eum aut. Incidunt autem porro non blanditiis. Accusantium ut minima omnis exercitationem. Inventore quis aut qui id nemo aspernatur est. Ut voluptatem accusamus aut. Adipisci consequatur sunt excepturi ut est ab suscipit nihil.'),
		'Iure tenetur odit consectetur nesciunt incidunt itaque. Et fugit adipisci \nnesciunt ut enim quam iste quos. Rerum quo nihil distinctio. Laboriosam natus \neius deserunt iusto. Fuga praesentium eum aut. Incidunt autem porro non \nblanditiis. Accusantium ut minima omnis exercitationem. Inventore quis aut qui \nid nemo aspernatur est. Ut voluptatem accusamus aut. Adipisci consequatur sunt \nexcepturi ut est ab suscipit nihil.'
	);

	unchanged(repeat('i', 100));
	unchanged(repeat('i', 60) + '\n' + repeat('i', 60));

	t.equal(
		email.toFlowed(repeat('i', 60) + ' ' + repeat('i', 60)),
		repeat('i', 60) + ' \n' + repeat('i', 60)
	);

	t.equal(
		email.toFlowed(repeat('i', 80) + ' a'),
		repeat('i', 80) + ' \na'
	);

	t.equal(
		email.toFlowed(repeat('i', 80) + '\na'),
		repeat('i', 80) + '\na'
	);
	t.equal(
		email.toFlowed(repeat('i', 60) + ' ' + repeat('i', 60) + '\na'),
		repeat('i', 60) + ' \n' + repeat('i', 60) + '\na'
	);

	t.end();
});

tap.test('getCanonicalAddress', function (t) {
	t.equal(email.getCanonicalAddress('basic@example.com'), 'basic@example.com');
	t.equal(email.getCanonicalAddress('common+address@example.com'), 'common+address@example.com');
	t.equal(email.getCanonicalAddress('1234@1234.example.net'), '1234@1234.example.net');
	t.equal(email.getCanonicalAddress('CASE@EXAMPLE.COM'), 'CASE@example.com');
	t.equal(email.getCanonicalAddress('"unnecessary-quotes"@example.com'), 'unnecessary-quotes@example.com');
	t.equal(email.getCanonicalAddress('"necessary@quotes"@example.com'), '"necessary@quotes"@example.com');
	t.equal(email.getCanonicalAddress('"unnecessary@\\escapes"@example.com'), '"unnecessary@escapes"@example.com');
	t.equal(email.getCanonicalAddress('"necessary\\ escapes"@example.com'), '"necessary\\ escapes"@example.com');

	t.equal(email.getCanonicalAddress('invalid'), null);
	t.equal(email.getCanonicalAddress(repeat('a', 243) + '@example.com'), null);
	t.equal(email.getCanonicalAddress('example.com'), null);
	t.equal(email.getCanonicalAddress('inv@al@id'), null);
	t.equal(email.getCanonicalAddress('invalid@example.com\n'), null);
	t.equal(email.getCanonicalAddress('explicitly(disallowed)@example.com'), null);
	t.equal(email.getCanonicalAddress('dange\rous@example.com'), null);
	t.equal(email.getCanonicalAddress('"dange\rous"@example.com'), null);
	t.equal(email.getCanonicalAddress('"dange\\\rous"@example.com'), null);
	t.equal(email.getCanonicalAddress('da\ngerous@example.com'), null);
	t.equal(email.getCanonicalAddress('"da\ngerous"@example.com'), null);
	t.equal(email.getCanonicalAddress('"da\\\ngerous"@example.com'), null);

	t.end();
});
