"use strict";

var bluebird = require("bluebird");
var mmmagic = require("mmmagic");

var types = require("./types");

var magic = new mmmagic.Magic(mmmagic.MAGIC_MIME_TYPE);
var detectFileAsync = bluebird.promisify(magic.detectFile, { context: magic });

function identify(filePath) {
	return detectFileAsync(filePath)
		.then(types.byMediaType);
}

exports.identify = identify;
