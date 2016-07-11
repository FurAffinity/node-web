'use strict';

var nunjucks = require('nunjucks');
var path = require('path');

var filters = require('../filters');
var types = require('../files/types');
var version = require('../version');

var getCsrfKey = require('../forms').getCsrfKey;

var templateRoot = path.join(__dirname, '../../templates');
var templateLoader = new nunjucks.FileSystemLoader(templateRoot, { watch: true });

var env = new nunjucks.Environment(
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

NunjucksRenderer.prototype.mediaType = 'text/html';

NunjucksRenderer.prototype.transform = function (request, response) {
	var templateData = Object.assign({ request: request }, response.data);

	response.setHeader('Content-Type', 'text/html; charset=utf-8');
	response.data = this.template.render(templateData);

	return response;
};

exports.NunjucksRenderer = NunjucksRenderer;
exports.environment = env;
