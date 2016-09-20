'use strict';

var ApplicationError = require('../errors').ApplicationError;

function UnknownMediaTypeError(mediaType) {
	ApplicationError.call(this, 'Unknown media type: ' + mediaType);
}

ApplicationError.extend(UnknownMediaTypeError);

var types = [
	{
		id: 'jpg',
		mediaType: 'image/jpeg',
		submissionType: 'image',
		description: 'JPEG',
		extension: 'jpg',
	},
	{
		id: 'png',
		mediaType: 'image/png',
		submissionType: 'image',
		description: 'PNG',
		extension: 'png',
	},
	{
		id: 'mp3',
		mediaType: 'audio/mpeg',
		submissionType: 'audio',
		description: 'MP3',
		extension: 'mp3',
	},
	{
		id: 'vorbis',
		mediaType: 'audio/ogg',
		submissionType: 'audio',
		description: 'Vorbis',
		extension: 'ogg',
	},
	{
		id: 'opus',
		mediaType: 'audio/ogg',
		submissionType: 'audio',
		description: 'Opus',
		extension: 'ogg',
	},
	{
		id: 'flac',
		mediaType: 'audio/x-flac',
		submissionType: 'audio',
		description: 'FLAC',
		extension: 'flac',
	},
	{
		id: 'm4a',
		mediaType: 'audio/x-m4a',
		submissionType: 'audio',
		description: 'AAC',
		extension: 'm4a',
	},
	{
		id: 'docx',
		mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		submissionType: 'text',
		description: 'Word document',
		extension: 'docx',
	},
	{
		id: 'epub',
		mediaType: 'application/epub+zip',
		submissionType: 'text',
		description: 'EPUB',
		extension: 'epub',
	},
];

var idMap = Object.create(null);
var mediaTypeMap = Object.create(null);

types.forEach(function (type) {
	idMap[type.id] = type;

	mediaTypeMap[type.mediaType] =
		type.mediaType in mediaTypeMap ?
			null :
			type;
});

function byId(id) {
	if (!(id in idMap)) {
		throw new Error('Unknown type id: ' + id);
	}

	return idMap[id];
}

function byMediaType(mediaType) {
	if (!(mediaType in mediaTypeMap)) {
		throw new UnknownMediaTypeError(mediaType);
	}

	var type = mediaTypeMap[mediaType];

	if (type === null) {
		throw new Error('Ambiguous media type: ' + mediaType);
	}

	return type;
}

exports.byId = byId;
exports.byMediaType = byMediaType;
exports.types = types;
