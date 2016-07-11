'use strict';

function Response() {
	this.headers = Object.create(null);
}

Response.prototype.send = function (httpResponse) {
	httpResponse.writeHead(this.statusCode, this.headers);
	httpResponse.end(this.data);
};

Response.prototype.setHeader = function (name, value) {
	this.headers[name.toLowerCase()] = value;
};

function responseType(statusCode, constructor) {
	constructor.prototype = Object.create(Response.prototype, {
		constructor: {
			configurable: true,
			writable: true,
			value: constructor,
		},
		statusCode: {
			configurable: true,
			value: statusCode,
		},
	});

	return constructor;
}

exports.Response = Response;

exports.Ok = responseType(200, function Ok(data) {
	Response.call(this);
	this.data = data;
});
