'use strict';

const ApplicationError = require('../errors').ApplicationError;

class UnknownMediaTypeError extends ApplicationError {
	constructor(mediaType) {
		super('Unknown media type: ' + mediaType);
	}
}

ApplicationError.extendClass(UnknownMediaTypeError);

const types = [
	{
		id: 'png',
		mediaType: 'image/png',
		submissionType: 'image',
		description: 'PNG',
		extension: 'png',
	},
	{
		id: 'jpeg',
		mediaType: 'image/jpeg',
		submissionType: 'image',
		description: 'JPEG',
		extension: 'jpg',
	},
	{
		id: 'gif',
		mediaType: 'image/gif',
		submissionType: 'image',
		description: 'GIF',
		extension: 'gif',
	},
	{
		id: 'webp',
		mediaType: 'image/webp',
		submissionType: 'image',
		description: 'WebP',
		extension: 'webp',
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
		id: 'aac',
		mediaType: 'audio/x-m4a',
		submissionType: 'audio',
		description: 'AAC',
		extension: 'm4a',
	},
	{
		id: 'mp3',
		mediaType: 'audio/mpeg',
		submissionType: 'audio',
		description: 'MP3',
		extension: 'mp3',
	},
	{
		id: 'flac',
		mediaType: 'audio/x-flac',
		submissionType: 'audio',
		description: 'FLAC',
		extension: 'flac',
	},
	{
		id: 'epub',
		mediaType: 'application/epub+zip',
		submissionType: 'text',
		description: 'EPUB',
		extension: 'epub',
	},
	{
		id: 'docx',
		mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		submissionType: 'text',
		description: 'Word document',
		extension: 'docx',
	},
];

const idMap = Object.create(null);
const mediaTypeMap = Object.create(null);

types.forEach(type => {
	idMap[type.id] = type;

	mediaTypeMap[type.mediaType] =
		type.mediaType in mediaTypeMap ?
			null :
			type;
});

const byId = id => {
	if (!(id in idMap)) {
		throw new Error('Unknown type id: ' + id);
	}

	return idMap[id];
};

const byMediaType = mediaType => {
	if (!(mediaType in mediaTypeMap)) {
		throw new UnknownMediaTypeError(mediaType);
	}

	const type = mediaTypeMap[mediaType];

	if (type === null) {
		throw new Error('Ambiguous media type: ' + mediaType);
	}

	return type;
};

exports.byId = byId;
exports.byMediaType = byMediaType;
exports.types = types;
