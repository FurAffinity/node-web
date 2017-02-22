'use strict';

const express = require('express');

const forms = require('../forms');

const router = new express.Router();

router.post('/logout', forms.getReader({ name: 'logout', fields: {} }), function (req, res, next) {
	req.app.sessionStorage.createGuestSession(req).done(
		function (newSession) {
			res.setSession(newSession);
			res.redirect('/');
		},
		next
	);
});

exports.router = router;
