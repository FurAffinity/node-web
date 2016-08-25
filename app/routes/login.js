'use strict';

var express = require('express');

var ApplicationError = require('../errors').ApplicationError;
var authentication = require('../authentication');
var duration = require('../duration');
var forms = require('../forms');
var rateLimit = require('../rate-limit');
var wrap = require('./wrap').wrap;

function get(req, res) {
	if (req.user !== null) {
		res.redirect('/');
		return;
	}

	res.render('login.html');
}

var post = wrap([
	rateLimit.byAddress('login', 10, duration.minutes(5)),
	forms.getReader({
		name: 'login',
		fields: {
			username: forms.one,
			password: forms.one,
		},
	}),
	function (req, res, next) {
		var form = req.form;

		if (!form.username) {
			form.addError('A username is required.', 'username');
		}

		if (!form.password) {
			form.addError('A password is required.', 'password');
		}

		if (!form.valid) {
			res.locals.form = form;
			res.status(422).render('login.html');
			return;
		}

		authentication.authenticate(form.username, form.password)
			.then(function (userId) {
				return req.app.sessionStorage.createUserSession(req, userId);
			})
			.done(
				function (newSession) {
					res.setSession(newSession);
					res.redirect('/');
				},
				function (error) {
					if (error instanceof ApplicationError) {
						form.addError(error);
						res.locals.form = form;
						res.render('login.html');
					} else {
						next(error);
					}
				}
			);
	},
]);

var router = new express.Router();

router.get('/login', get);
router.post('/login', post);

exports.router = router;
