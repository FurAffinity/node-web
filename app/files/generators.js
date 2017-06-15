'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const sharp = require('sharp-binaryless');

const files = require('./');

const SUBMISSION_PIXEL_LIMIT = 8000 * 8000;

const WEBP_LOSSLESS_CODE = 76;  // L
const WEBP_LOSSLESS_CODE_OFFSET = 15;

const constant = x => () => x;

const readStream = stream =>
	new Promise((resolve, reject) => {
		const parts = [];

		stream.on('data', part => {
			parts.push(part);
		});

		stream.on('end', () => {
			resolve(Buffer.concat(parts));
		});

		stream.on('error', reject);
	});

const losslessnessTests = Object.create(null);
losslessnessTests.jpeg = constant(Promise.resolve(false));
losslessnessTests.png = losslessnessTests.gif = constant(Promise.resolve(true));
losslessnessTests.webp = filePath =>
	readStream(
		fs.createReadStream(filePath, {
			start: WEBP_LOSSLESS_CODE_OFFSET,
			end: WEBP_LOSSLESS_CODE_OFFSET + 1,
		})
	).then(buffer => buffer[0] === WEBP_LOSSLESS_CODE);

const getIsLossless = (format, filePath) => {
	const test = losslessnessTests[format];

	return test ?
		test(filePath) :
		Promise.reject(new Error('Unknown format: ' + format));
};

const getImageRepresentationsForRole = (context, role, isLossless, thumbnailPipeline) => {
	const formats =
		isLossless ?
			[
				{
					id: 'png',
					buffer: thumbnailPipeline.png({
						compressionLevel: 9,
					}).toBuffer(),
				},
				{
					id: 'webp',
					buffer: thumbnailPipeline.webp({
						quality: 100,
						lossless: true,
					}).toBuffer(),
				},
			] :
			[
				{
					id: 'jpeg',
					buffer: thumbnailPipeline.jpeg({
						quality: 100,
						trellisQuantisation: true,
						overshootDeringing: true,
					}).toBuffer(),
				},
				{
					id: 'webp',
					buffer: thumbnailPipeline.webp({
						quality: 100,
					}).toBuffer(),
				},
			];

	return formats.map(format =>
		format.buffer
			.then(buffer =>
				files.insertBuffer(context, buffer)
			)
			.then(
				file => ({
					role: role,
					type: format.id,
					file: file,
				})
			)
	);
};

const getImageRepresentations = (context, temporaryFile) =>
	getIsLossless(temporaryFile.type, temporaryFile.path)
		.then(isLossless => {
			const imagePipeline =
				sharp(temporaryFile.path)
					.limitInputPixels(SUBMISSION_PIXEL_LIMIT)
					.rotate()
					.max()
					.withoutEnlargement();

			const original =
				files.insertFile(context, temporaryFile.digest, temporaryFile.byteSize, temporaryFile.path).then(
					file => ({
						role: 'content',
						type: temporaryFile.type,
						file: file,
					})
				);

			const representations =
				[original].concat(
					getImageRepresentationsForRole(
						context,
						'thumbnail',
						isLossless,
						imagePipeline.resize(200, 200, { interpolator: 'nohalo' })
					),
					getImageRepresentationsForRole(
						context,
						'thumbnail@2x',
						isLossless,
						imagePipeline.resize(400, 400, { interpolator: 'nohalo' })
					)
				);

			// TODO: add animated thumbnails, previews

			return Promise.all(representations);
		});

const submissionGenerators = Object.create(null);
submissionGenerators.png = getImageRepresentations;
submissionGenerators.jpeg = getImageRepresentations;
submissionGenerators.gif = getImageRepresentations;
submissionGenerators.webp = getImageRepresentations;

exports.submissionGenerators = submissionGenerators;
