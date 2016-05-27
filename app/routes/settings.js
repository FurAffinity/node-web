"use strict";

var express = require("express");

var permissions = require("../permissions");

var router = new express.Router();

router.get("/settings/profile", permissions.user.middleware, function (req, res) {
	res.render("settings/profile.html");
});

exports.router = router;
