"use strict";

var errors = require("../errors");
var generators = require("./generators");

function UnknownMediaTypeError(mediaType) {
	errors.ApplicationError.call(this, "Unknown media type: " + mediaType);
}

errors.ApplicationError.extend(UnknownMediaTypeError);

var types = [
	{
		id: "jpg",
		mediaType: "image/jpeg",
		submissionType: "image",
		description: "JPEG",
		generators: [generators.thumbnail],
	},
	{
		id: "png",
		mediaType: "image/png",
		submissionType: "image",
		description: "PNG",
		generators: [generators.thumbnail],
	},
	{
		id: "mp3",
		mediaType: "audio/mpeg",
		submissionType: "audio",
		description: "MP3",
		generators: [generators.ogg, generators.waveform],
	},
	{
		id: "ogg",
		mediaType: "audio/ogg",
		submissionType: "audio",
		description: "Vorbis",
		generators: [generators.waveform],
	},
	{
		id: "flac",
		mediaType: "audio/x-flac",
		submissionType: "audio",
		description: "FLAC",
		generators: [generators.ogg, generators.waveform],
	},
	{
		id: "docx",
		mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		submissionType: "text",
		description: "Word document",
		generators: [generators.html],
	},
	{
		id: "epub",
		mediaType: "application/epub+zip",
		submissionType: "text",
		description: "EPUB",
		generators: [generators.html],
	},
];

var idMap = Object.create(null);
var mediaTypeMap = Object.create(null);

types.forEach(function (type) {
	idMap[type.id] = type;
	mediaTypeMap[type.mediaType] = type;
});

function byId(id) {
	if (!(id in idMap)) {
		throw new Error("Unknown type id: " + id);
	}

	return idMap[id];
}

function byMediaType(mediaType) {
	if (!(mediaType in mediaTypeMap)) {
		throw new UnknownMediaTypeError(mediaType);
	}

	return mediaTypeMap[mediaType];
}

exports.byId = byId;
exports.byMediaType = byMediaType;
exports.types = types;
