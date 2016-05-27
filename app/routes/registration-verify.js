"use strict";

var express = require("express");

var r = String.raw;

var forms = require("../forms");
var users = require("../users");

var router = new express.Router();

router.get(r`/users/:id(\d+)/\+verify`, function (req, res) {
	res.render("registration-verify.html");
});

router.post(r`/users/:id(\d+)/\+verify`, forms.getReader({ name: "register-verify", fields: [] }), function (req, res, next) {
	var userId = req.params.id | 0;
	var key = Buffer.from(String(req.query.key), "base64");

	users.verifyRegistrationKey(userId, key).done(
		function () {
			res.redirect("/login");
		},
		next
	);
});

exports.router = router;
