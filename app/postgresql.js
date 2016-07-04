"use strict";

var OID_BYTEA = 17;

function serializeByteaArray(values) {
	var count = values.length;
	var size = 20 + 4 * count;
	var hasNulls = false;
	var value;
	var i;

	for (i = 0; i < count; i++) {
		value = values[i];

		if (value === null) {
			hasNulls = true;
		} else {
			size += value.length;
		}
	}

	var result = Buffer.alloc(size);

	result.writeInt32BE(1, 0); // number of dimensions
	result.writeInt32BE(hasNulls | 0, 4); // flags (ignored)
	result.writeInt32BE(OID_BYTEA, 8); // element type

	result.writeInt32BE(count, 12); // size of dimension
	result.writeInt32BE(1, 16); // lower bound of dimension

	var offset = 20;

	for (i = 0; i < count; i++) {
		value = values[i];

		if (value === null) {
			result.writeInt32BE(-1, offset);
			offset += 4;
		} else {
			result.writeInt32BE(value.length, offset);
			offset += 4;

			value.copy(result, offset);
			offset += value.length;
		}
	}

	return result;
}

exports.serializeByteaArray = serializeByteaArray;
