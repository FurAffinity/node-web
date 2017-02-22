'use strict';

const concat = collections => {
	const result = [];
	const l = collections.length;

	for (let i = 0; i < l; i++) {
		const collection = collections[i];
		const m = collection.length;

		for (let j = 0; j < m; j++) {
			result.push(collection[j]);
		}
	}

	return result;
};

const const_ = x => () => x;

const id = x => x;

exports.concat = concat;
exports.const = const_;
exports.id = id;
