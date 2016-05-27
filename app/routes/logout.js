"use strict";

var express = require("express");

var forms = require("../forms");

var router = new express.Router();

router.post("/logout", forms.getReader({ name: "logout", fields: {} }), function (req, res, next) {
	req.session.replaceWithGuest().done(
		function () {
			res.redirect("/");
		},
		next
	);
});

exports.router = router;
