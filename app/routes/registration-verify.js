'use strict';

const express = require('express');

const r = String.raw;

const forms = require('../forms');
const users = require('../users');

const router = new express.Router();

router.get(r`/users/:id(\d+)/\+verify`, function (req, res) {
	res.render('registration-verify.html');
});

router.post(r`/users/:id(\d+)/\+verify`, forms.getReader({ name: 'register-verify', fields: [] }), function (req, res, next) {
	const userId = req.params.id | 0;
	const key = Buffer.from(String(req.query.key), 'base64');

	users.verifyRegistrationKey(req.context, userId, key).done(
		function () {
			res.redirect('/login');
		},
		next
	);
});

exports.router = router;
