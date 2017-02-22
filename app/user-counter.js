'use strict';

const dgram = require('dgram');
const ipaddr = require('ipaddr.js');

function UserCounter(options) {
	const that = this;
	const socket = dgram.createSocket('udp4');

	this.userCount = 0;
	this.socket = socket;
	this.host = options.host;
	this.port = options.port;

	socket.on('message', function (message) {
		that.userCount = message.readUInt32BE(0);
	});

	socket.bind(options.listenHost);
}

UserCounter.prototype.addUser = function (address) {
	if (address.startsWith('[') && address.endsWith(']')) {
		address = address.slice(1, -1);
	}

	const addressBytes = Buffer.from(ipaddr.parse(address).toByteArray());
	let message;

	if (addressBytes.length === 4) {
		message = Buffer.alloc(16);
		message[10] = 0xff;
		message[11] = 0xff;
		addressBytes.copy(message, 12);
	} else {
		message = addressBytes;
	}

	this.socket.send(message, this.port, this.host);
};

UserCounter.prototype.close = function (callback) {
	this.socket.close(callback);
};

Object.defineProperty(UserCounter.prototype, 'middleware', {
	configurable: true,
	get: function () {
		const that = this;

		return function (req, res, next) {
			if (req.forwarded.for) {
				that.addUser(req.forwarded.for);
			}

			req.userCount = that.userCount;
			next();
		};
	},
});

exports.UserCounter = UserCounter;
