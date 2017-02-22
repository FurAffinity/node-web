'use strict';

const Busboy = require('busboy');
const bluebird = require('bluebird');
const crypto = require('crypto');

const ApplicationError = require('./errors').ApplicationError;
const config = require('./config');
const timingSafeCompare = require('./timing-safe-compare').timingSafeCompare;

const disallowedFieldNames = [
	'hasOwnProperty',
	'addError',
	'valid',
	'errors',
	'form',
];

const one = Symbol('one');
const many = Symbol('many');

const csrfTokenName = 't';
const csrfMacKey = Buffer.from(config.forms.csrf_mac_key, 'base64');

class FormError extends ApplicationError {}

ApplicationError.extendClass(FormError);

class CsrfError extends FormError {}

FormError.extendClass(CsrfError);

class Form {
	constructor(fields) {
		this.valid = true;
		this.errors = { form: [] };
		this.errorTypes = new Set();

		for (const name in fields) {
			if (fields.hasOwnProperty(name)) {
				const type = fields[name];

				if (type.count === one) {
					this[name] = null;
				} else if (type.count === many) {
					this[name] = [];
				} else {
					throw new TypeError('Expected field type to be one or many');
				}

				this.errors[name] = [];
			}
		}
	}

	addError(error, field) {
		this.errors[field || 'form'].push(error);
		this.valid = false;

		let typed = error;

		do {
			this.errorTypes.add(typed.constructor.name);
			typed = Object.getPrototypeOf(typed);
		} while (typed);
	}
}

const getCsrfKey = (session, endpoint) =>
	crypto.createHmac('sha256', csrfMacKey)
		.update(session.sessionId)
		.update(endpoint, 'utf8')
		.digest();

const getReader = schema => {
	disallowedFieldNames.forEach(name => {
		if (Object.prototype.hasOwnProperty.call(schema.fields, name)) {
			throw new Error('Invalid field name: ' + name);
		}
	});

	return function reader(request, response, next) {
		let busboy;

		try {
			busboy = new Busboy({
				headers: request.headers,
			});
		} catch (error) {
			next(error);
			return;
		}

		const expectedCsrfKey = getCsrfKey(request.session, schema.name);
		const form = new Form(schema.fields);
		const reads = [];

		const readField = (name, value, nameTruncated, valueTruncated) => {
			if (nameTruncated) {
				return;
			}

			if (valueTruncated) {
				busboy.removeListener('field', readField);
				busboy.removeListener('file', readFile);
				busboy.removeListener('finish', readFinish);

				next(new FormError('Field too large'));
				return;
			}

			if (!schema.fields.hasOwnProperty(name)) {
				return;
			}

			const type = schema.fields[name];

			if (type.reader !== null) {
				return;
			}

			if (type.count === many) {
				form[name].push(value);
			} else {
				form[name] = value;
			}
		};

		const readFile = (name, stream, filename) => {
			const type = schema.fields[name];

			if (!schema.fields.hasOwnProperty(name) || type.reader === null) {
				stream.resume();
				return;
			}

			const fileReader = type.reader;

			reads.push(
				fileReader(request, stream, filename)
					.then(value => {
						if (type.count === many) {
							form[name].push(value);
						} else {
							form[name] = value;
						}
					})
			);
		};

		const readFinish = () => {
			bluebird.all(reads).done(
				() => {
					request.form = form;
					next();
				},
				next
			);
		};

		const csrfField = (name, value) => {
			if (name !== csrfTokenName) {
				return;
			}

			busboy.removeListener('field', csrfField);
			busboy.removeListener('finish', csrfFinish);

			const csrfKey = Buffer.from(value, 'base64');

			if (!timingSafeCompare(expectedCsrfKey, csrfKey)) {
				next(new CsrfError('CSRF token invalid'));
				return;
			}

			busboy.on('field', readField);
			busboy.on('file', readFile);
			busboy.on('finish', readFinish);
		};

		const csrfFinish = () => {
			next(new CsrfError('CSRF token missing'));
		};

		busboy.on('field', csrfField);
		busboy.on('finish', csrfFinish);

		request.pipe(busboy);
	};
};

exports.getCsrfKey = getCsrfKey;
exports.getReader = getReader;
exports.many = { count: many, reader: null };
exports.one = { count: one, reader: null };

exports.manyFiles = reader =>
	({ count: many, reader: reader });

exports.oneFile = reader =>
	({ count: one, reader: reader });
