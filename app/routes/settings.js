"use strict";

var express = require("express");

var config = require("../config");
var duration = require("../duration");
var files = require("../files");
var filters = require("../filters");
var forms = require("../forms");
var permissions = require("../permissions");
var rateLimit = require("../rate-limit");
var totp = require("../totp");
var types = require("../files/types");
var users = require("../users");

var validRatings = new Set([
	"general",
	"mature",
	"adult",
]);

var router = new express.Router();

function readProfileImage(stream) {
	return files.storeUploadOrEmpty(stream, types.profileImageGenerators)
		.then(function (generatedFiles) {
			return generatedFiles && generatedFiles.profileImage;
		});
}

function readBanner(stream) {
	return files.storeUploadOrEmpty(stream, types.bannerGenerators)
		.then(function (generatedFiles) {
			return generatedFiles && generatedFiles.banner;
		});
}

router.get("/settings/profile", permissions.user.middleware, function (req, res, next) {
	users.viewProfile(req.user.id).done(
		function (profile) {
			res.render("settings/profile.html", {
				profile: profile,
			});
		},
		next
	);
});

router.post("/settings/profile",
	permissions.user.middleware,
	forms.getReader({
		name: "profile-settings",
		fields: {
			"profile-image": forms.oneFile(readProfileImage),
			"banner": forms.oneFile(readBanner),
			"full-name": forms.one,
			"profile-type": forms.one,
			"profile-text": forms.one,
		},
	}),
	function (req, res, next) {
		var form = req.form;

		users.updateProfile(
			req.user.id,
			{
				banner: form.banner,
				profileImage: form["profile-image"],
				fullName: form["full-name"],
				profileType: form["profile-type"],
				profileText: form["profile-text"],
			}
		).done(
			function () {
				res.redirect(filters.userPath(req.user));
			},
			next
		);
	});

router.get("/settings/browsing", permissions.user.middleware, function (req, res) {
	res.render("settings/browsing.html", { updated: false });
});

router.post("/settings/browsing",
	permissions.user.middleware,
	forms.getReader({
		name: "browsing-settings",
		fields: {
			rating: forms.one,
		},
	}),
	function (req, res, next) {
		var form = req.form;

		if (!validRatings.has(form.rating)) {
			res.status(400).send("Invalid rating");
			return;
		}

		users.updatePreferences(req.user.id, form).done(
			function () {
				req.user.ratingPreference = form.rating;
				res.render("settings/browsing.html", { updated: true });
			},
			next
		);
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
