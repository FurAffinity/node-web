'use strict';

const negapi = require('negapi');
const nunjucks = require('nunjucks');
const path = require('path');

const filters = require('../filters');
const types = require('../files/types');
const version = require('../version');

const getCsrfKey = require('../forms').getCsrfKey;

const templateRoot = path.join(__dirname, '../../templates');
const templateLoader = new nunjucks.FileSystemLoader(templateRoot);

const env = new nunjucks.Environment(
	templateLoader,
	{
		autoescape: true,
		throwOnUndefined: true,
	}
);

version.getGitRevision().then(function (gitRevision) {
	env.addGlobal('siteRevision', gitRevision);
});

env.addGlobal('getCsrfToken', function (request, endpoint) {
	return getCsrfKey(request.session, endpoint).toString('base64');
});

env.addFilter('type_name', function (fileType) {
	return types.byId(fileType).description;
});

env.addFilter('type_media_type', function (fileType) {
	return types.byId(fileType).mediaType;
});

env.addFilter('type_extension', function (fileType) {
	return types.byId(fileType).extension;
});

env.addFilter('bbcode', filters.bbcode);
env.addFilter('bbcodeWithExcerpt', filters.bbcodeWithExcerpt);
env.addFilter('clean_html', filters.cleanHtml);
env.addFilter('file_path', filters.filePath);
env.addFilter('file_size', filters.formatFileSize);
env.addFilter('relative_date', filters.relativeDate);
env.addFilter('user_path', filters.userPath);

function NunjucksRenderer(templatePath) {
	this.template = env.getTemplate(templatePath, true);
}

NunjucksRenderer.prototype.mediaType = new negapi.MediaType('text', 'html');

NunjucksRenderer.prototype.transform = function (request, response) {
	const templateData = Object.assign({ request: request }, response.data);

	response.setHeader('Content-Type', 'text/html; charset=utf-8');
	response.data = this.template.render(templateData);

	return response;
};

exports.NunjucksRenderer = NunjucksRenderer;
exports.environment = env;
