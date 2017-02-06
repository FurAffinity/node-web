'use strict';

const concat = collections => {
	var result = [];

	for (var i = 0, l = collections.length; i < l; i++) {
		var collection = collections[i];

		for (var j = 0, m = collection.length; j < m; j++) {
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
