'use strict';

var bluebird = require('bluebird');

var nunjucks = require('./nunjucks');

function renderWith(renderers, source) {
	return function (request) {
		if (renderers.length !== 1) {
			throw new Error('Not implemented');
		}

		var renderer = renderers[0];

		return bluebird.resolve(source(request))
			.then(function (response) {
				return renderer.transform(request, response);
			});
	};
}

exports.NunjucksRenderer = nunjucks.NunjucksRenderer;
exports.nunjucksEnvironment = nunjucks.environment;
exports.renderWith = renderWith;
