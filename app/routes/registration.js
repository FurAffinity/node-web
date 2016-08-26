'use strict';

var express = require('express');

var ApplicationError = require('../errors').ApplicationError;
var forms = require('../forms');
var users = require('../users');
var wrap = require('./wrap').wrap;

function get(req, res) {
	if (req.user !== null) {
		res.redirect('/');
		return;
	}

	res.render('register.html');
}

var post = wrap([
	forms.getReader({
		name: 'register',
		fields: {
			username: forms.one,
			password: forms.one,
			email: forms.one,
		},
	}),
	function (req, res, next) {
		var form = req.form;

		if (!form.username) {
			form.addError('A username is required', 'username');
		}

		if (!form.password) {
			form.addError('A password is required', 'password');
		} else if (form.password.length < 8) {
			form.addError('Passwords must be at least 8 characters long', 'password');
		} else if (form.password.length > 72) {
			form.addError('Passwords must be at most 72 characters long', 'password');
		}

		if (!form.email) {
			form.addError('An e-mail address is required', 'email');
		}

		if (!form.valid) {
			res.locals.form = form;
			res.status(422).render('register.html');
			return;
		}

		users.registerUser(req.context, req.form).done(
			function (canonicalEmail) {
				res.render('registration-email-sent.html', {
					email: canonicalEmail,
				});
			},
			function (error) {
				if (error instanceof ApplicationError) {
					var field;

					if (error instanceof users.UsernameConflictError || error instanceof users.UsernameInvalidError) {
						field = 'username';
					} else if (error instanceof users.EmailInvalidError) {
						field = 'email';
					} else {
						field = null;
					}

					form.addError(error.message, field);
					res.locals.form = form;
					res.status(422).render('register.html');
				} else {
					next(error);
				}
			}
		);
	},
]);

var router = new express.Router();

router.get('/users/new', get);
router.post('/users/', post);

exports.router = router;
