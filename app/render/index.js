'use strict';

var Promise = require('bluebird');
var negapi = require('negapi');

var httpErrors = require('../http-errors');
var json = require('./json');
var nunjucks = require('./nunjucks');

function renderWith(renderers, source) {
	var types = new negapi.MediaTypeSet(
		renderers.map(function (renderer) {
			return renderer.mediaType;
		})
	);

	var typeMap = new Map(
		renderers.map(function (renderer) {
			return [renderer.mediaType, renderer];
		})
	);

	return function (request) {
		var type = negapi.select(types, request.headers.accept);

		if (!type) {
			return Promise.reject(new httpErrors.NotAcceptableError());
		}

		var renderer = typeMap.get(type);

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
