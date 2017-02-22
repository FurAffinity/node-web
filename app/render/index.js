'use strict';

const Promise = require('bluebird');
const negapi = require('negapi');

const httpErrors = require('../http-errors');
const json = require('./json');
const nunjucks = require('./nunjucks');

function renderWith(renderers, source) {
	const types = new negapi.MediaTypeSet(
		renderers.map(function (renderer) {
			return renderer.mediaType;
		})
	);

	const typeMap = new Map(
		renderers.map(function (renderer) {
			return [renderer.mediaType, renderer];
		})
	);

	return function (request) {
		const type = negapi.select(types, request.headers.accept);

		if (!type) {
			return Promise.reject(new httpErrors.NotAcceptableError());
		}

		const renderer = typeMap.get(type);

		return Promise.resolve(source(request))
			.then(function (response) {
				return renderer.transform(request, response);
			});
	};
}

exports.JSONRenderer = json.JSONRenderer;
exports.NunjucksRenderer = nunjucks.NunjucksRenderer;
exports.nunjucksEnvironment = nunjucks.environment;
exports.renderWith = renderWith;
