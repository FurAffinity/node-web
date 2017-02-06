'use strict';

var negapi = require('negapi');

function JSONRenderer(renderer) {
	this.renderer = renderer;
}

JSONRenderer.prototype.mediaType = new negapi.MediaType('application', 'json');

JSONRenderer.prototype.transform = function (request, response) {
	var renderer = this.renderer;

	response.setHeader('Content-Type', 'application/json; charset=utf-8');
	response.data = JSON.stringify(renderer(response.data));

	return response;
};

exports.JSONRenderer = JSONRenderer;
