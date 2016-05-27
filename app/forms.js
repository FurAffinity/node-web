"use strict";

var Busboy = require("busboy");
var bluebird = require("bluebird");
var crypto = require("crypto");

var ApplicationError = require("./errors").ApplicationError;
var config = require("./config");
var timingSafeCompare = require("./timing-safe-compare").timingSafeCompare;

var disallowedFieldNames = [
	"hasOwnProperty",
	"addError",
	"valid",
	"errors",
	"form",
];

var one = Symbol("one");
var many = Symbol("many");

var csrfTokenName = "t";
var csrfMacKey = Buffer.from(config.forms.csrf_mac_key, "base64");

function FormError(message) {
	ApplicationError.call(this, message);
}

ApplicationError.extend(FormError);

function CsrfError(message) {
	FormError.call(this, message);
}

FormError.extend(CsrfError);

function Form(fields) {
	this.valid = true;
	this.errors = { form: [] };

	for (var name in fields) {
		if (fields.hasOwnProperty(name)) {
			var type = fields[name];

			if (type.count === one) {
				this[name] = null;
			} else if (type.count === many) {
				this[name] = [];
			} else {
				throw new TypeError("Expected field type to be one or many");
			}

			this.errors[name] = [];
		}
	}
}

Form.prototype.addError = function (error, field) {
	this.errors[field || "form"].push(error);
	this.valid = false;
};

function getCsrfKey(session, endpoint) {
	return crypto.createHmac("sha256", csrfMacKey)
		.update(session.sessionId)
		.update(endpoint, "utf8")
		.digest();
}

function getReader(schema) {
	disallowedFieldNames.forEach(function (name) {
		if (Object.prototype.hasOwnProperty.call(schema.fields, name)) {
			throw new Error("Invalid field name: " + name);
		}
	});

	return function reader(request, response, next) {
		var busboy;

		try {
			busboy = new Busboy({
				headers: request.headers,
			});
		} catch (error) {
			next(error);
			return;
		}

		var expectedCsrfKey = getCsrfKey(request.session, schema.name);
		var form = new Form(schema.fields);
		var reads = [];

		function readField(name, value, nameTruncated, valueTruncated) {
			if (nameTruncated) {
				return;
			}

			if (valueTruncated) {
				busboy.removeListener("field", readField);
				busboy.removeListener("file", readFile);
				busboy.removeListener("finish", readFinish);

				next(new FormError("Field too large"));
				return;
			}

			if (!schema.fields.hasOwnProperty(name)) {
				return;
			}

			var type = schema.fields[name];

			if (type.reader !== null) {
				return;
			}

			if (type.count === many) {
				form[name].push(value);
			} else {
				form[name] = value;
			}
		}

		function readFile(name, stream, filename) {
			var type;

			if (!schema.fields.hasOwnProperty(name) || (type = schema.fields[name]).reader === null) {
				stream.resume();
				return;
			}

			var fileReader = type.reader;

			reads.push(
				fileReader(stream, filename)
					.then(function (value) {
						if (type.count === many) {
							form[name].push(value);
						} else {
							form[name] = value;
						}
					})
			);
		}

		function readFinish() {
			bluebird.all(reads).done(
				function () {
					request.form = form;
					next();
				},
				next
			);
		}

		function csrfField(name, value) {
			if (name !== csrfTokenName) {
				return;
			}

			busboy.removeListener("field", csrfField);
			busboy.removeListener("finish", csrfFinish);

			var csrfKey = Buffer.from(value, "base64");

			if (!timingSafeCompare(expectedCsrfKey, csrfKey)) {
				next(new CsrfError("CSRF token invalid"));
				return;
			}

			busboy.on("field", readField);
			busboy.on("file", readFile);
			busboy.on("finish", readFinish);
		}

		function csrfFinish() {
			next(new CsrfError("CSRF token missing"));
		}

		busboy.on("field", csrfField);
		busboy.on("finish", csrfFinish);

		request.pipe(busboy);
	};
}

exports.getCsrfKey = getCsrfKey;
exports.getReader = getReader;
exports.many = { count: many, reader: null };
exports.one = { count: one, reader: null };

exports.manyFiles = function (reader) {
	return { count: many, reader: reader };
};

exports.oneFile = function (reader) {
	return { count: one, reader: reader };
};
