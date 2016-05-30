"use strict";

var express = require("express");

var config = require("../config");
var duration = require("../duration");
var forms = require("../forms");
var permissions = require("../permissions");
var rateLimit = require("../rate-limit");
var totp = require("../totp");
var users = require("../users");

var router = new express.Router();

router.get("/settings/profile", permissions.user.middleware, function (req, res) {
	res.render("settings/profile.html");
});

router.get("/settings/account", permissions.user.middleware, function (req, res) {
	res.render("settings/account.html");
});

router.get("/settings/account/two-factor",
	permissions.user.middleware,
	rateLimit.byAddress("two-factor-setup", 20, duration.minutes(5)),
	function (req, res, next) {
		var key = totp.generateKey();
		var encodedKey = totp.base32Encode(key);

		totp.getKeyBarcode(config.totp.issuer, req.user.displayUsername, encodedKey).done(
			function (barcodeUri) {
				res.render("settings/two-factor.html", {
					barcodeUri: barcodeUri,
					key: key,
					encodedKey: encodedKey,
				});
			},
			next
		);
	});

router.post("/settings/account/two-factor",
	permissions.user.middleware,
	rateLimit.byAddress("two-factor-setup", 20, duration.minutes(5)),
	forms.getReader({
		name: "two-factor",
		fields: {
			key: forms.one,
			otp: forms.one,
		},
	}),
	function (req, res, next) {
		var form = req.form;

		if (form.key === null || form.otp === null) {
			res.status(400).send("key and otp fields required");
			return;
		}

		var key = Buffer.from(form.key, "base64");

		if (key.length !== totp.secretLength) {
			res.status(400).send("invalid key length");
			return;
		}

		var counter = totp.getCodeCounter(key, form.otp);

		if (counter === null) {
			form.addError("The code didn’t match; check your device’s clock.", "otp");
			res.locals.form = form;

			var encodedKey = totp.base32Encode(key);

			totp.getKeyBarcode(config.totp.issuer, req.user.displayUsername, encodedKey).done(
				function (barcodeUri) {
					res.render("settings/two-factor.html", {
						barcodeUri: barcodeUri,
						key: key,
						encodedKey: encodedKey,
					});
				},
				next
			);
		} else {
			users.setupTwoFactor(req.user.id, key, counter).done(
				function () {
					res.redirect("/settings/account");
				},
				next
			);
		}
	});

exports.router = router;
