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
	},
	{
		id: "png",
		mediaType: "image/png",
		submissionType: "image",
		description: "PNG",
	},
	{
		id: "mp3",
		mediaType: "audio/mpeg",
		submissionType: "audio",
		description: "MP3",
	},
	{
		id: "ogg",
		mediaType: "audio/ogg",
		submissionType: "audio",
		description: "Vorbis",
	},
	{
		id: "flac",
		mediaType: "audio/x-flac",
		submissionType: "audio",
		description: "FLAC",
	},
	{
		id: "m4a",
		mediaType: "audio/x-m4a",
		submissionType: "audio",
		description: "AAC",
	},
	{
		id: "docx",
		mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		submissionType: "text",
		description: "Word document",
	},
	{
		id: "epub",
		mediaType: "application/epub+zip",
		submissionType: "text",
		description: "EPUB",
	},
];

var submissionGenerators = {
	jpg: [generators.thumbnail],
	png: [generators.thumbnail],
	mp3: [generators.ogg, generators.waveform],
	ogg: [generators.waveform],
	flac: [generators.ogg, generators.waveform],
	m4a: [generators.ogg, generators.waveform],
	docx: [generators.html],
	epub: [generators.html],
};

var profileImageGenerators = {
	jpg: [generators.profileImage],
	png: [generators.profileImage],
};

var bannerGenerators = {
	jpg: [generators.banner],
	png: [generators.banner],
};

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

exports.bannerGenerators = bannerGenerators;
exports.byId = byId;
exports.byMediaType = byMediaType;
exports.profileImageGenerators = profileImageGenerators;
exports.submissionGenerators = submissionGenerators;
exports.types = types;
