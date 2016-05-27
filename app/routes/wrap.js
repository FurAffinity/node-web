"use strict";

function wrap(handlers) {
	return function (req, res, next) {
		function nextHandler(index, error) {
			if (error || index === handlers.length) {
				next(error);
				return;
			}

			var handler = handlers[index];

			handler(req, res, function (error) {
				nextHandler(index + 1, error);
			});
		}

		nextHandler(0, null);
	};
}

exports.wrap = wrap;
