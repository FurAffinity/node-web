'use strict';

function concat(collections) {
	var result = [];

	for (var i = 0, l = collections.length; i < l; i++) {
		var collection = collections[i];

		for (var j = 0, m = collection.length; j < m; j++) {
			result.push(collection[j]);
		}
	}

	return result;
}

function const_(x) {
	return function () {
		return x;
	};
}

exports.concat = concat;
exports.const = const_;
