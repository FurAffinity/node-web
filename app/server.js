"use strict";

var bluebird = require("bluebird");
var express = require("express");
var nunjucks = require("nunjucks");
var strictCookieParser = require("strict-cookie-parser");

var config = require("./config");
var database = require("./database");
var errors = require("./errors");
var filters = require("./filters");
var types = require("./files/types");
var userCounter = require("./user-counter");
var users = require("./users");
var version = require("./version");

var DatabaseSessionStore = require("./sessions/database-store").DatabaseSessionStore;
var getCsrfKey = require("./forms").getCsrfKey;

var app = express();

var sessionStorage = new DatabaseSessionStore({
	database: database,
	macKey: Buffer.from(config.sessions.session_mac_key, "base64"),
	cookieName: config.sessions.cookie_name,
	cookieSecure: config.sessions.cookie_secure,
	userSessionRekeyTime: config.sessions.user_session_rekey_time,
	userSessionLifetime: config.sessions.user_session_lifetime,
});

var templateLoader = new nunjucks.FileSystemLoader("templates", { watch: true });

var env = new nunjucks.Environment(
	templateLoader,
	{
		autoescape: true,
		throwOnUndefined: true,
	}
);

version.getGitRevision().then(function (gitRevision) {
	env.addGlobal("siteRevision", gitRevision);
});

env.addFilter("type_name", function (fileType) {
	return types.byId(fileType).description;
});

env.addFilter("bbcode", filters.bbcode);
env.addFilter("bbcodeWithExcerpt", filters.bbcodeWithExcerpt);
env.addFilter("clean_html", filters.cleanHtml);
env.addFilter("file_path", filters.filePath);
env.addFilter("file_size", filters.formatFileSize);
env.addFilter("relative_date", filters.relativeDate);
env.addFilter("user_path", filters.userPath);

env.express(app);

// Let’s not allow users to put arbitrary structures in `req.query`.
app.set("query parser", "simple");

// Hardly.
app.disable("x-powered-by");

if (app.get("env") === "development") {
	bluebird.longStackTraces();
}

function withUserMeta(request, response, next) {
	var userId = request.session.userId;

	if (userId === null) {
		request.user = null;
		next();
		return;
	}

	users.getUserMeta(userId).done(
		function (userMeta) {
			request.user = userMeta;
			next();
		},
		next
	);
}

function templateLocals(request, response, next) {
	response.locals.getCsrfToken = function (endpoint) {
		return getCsrfKey(request.session, endpoint).toString("base64");
	};

	response.locals.request = request;
	response.locals.user = request.user;

	next();
}

app.use(function (req, res, next) {
	req.forwarded = {
		for: req.headers["x-forwarded-for"],
	};

	next();
});

app.use(strictCookieParser.middleware);
app.use(sessionStorage.middleware);
app.use(withUserMeta);
app.use(templateLocals);
app.use(userCounter.middleware);

app.use(require("./routes/home").router);
app.use(require("./routes/login").router);
app.use(require("./routes/logout").router);
app.use(require("./routes/profile").router);
app.use(require("./routes/registration").router);
app.use(require("./routes/registration-verify").router);
app.use(require("./routes/settings").router);
app.use(require("./routes/submissions-create").router);
app.use(require("./routes/submissions-upload").router);
app.use(require("./routes/submissions-view").router);
app.use(require("./routes/submissions-comment").router);
app.use(require("./routes/submissions-hide").router);

app.use(function (error, req, res, next) {
	if (res.headersSent || !(error instanceof errors.ApplicationError)) {
		next(error);
		return;
	}

	res.render("error.html", { error: error });
});

app.listen(5000, "127.0.0.1", function () {
	console.log("Started up in " + process.uptime().toFixed(3) + " s");
});