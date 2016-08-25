'use strict';

var dgram = require('dgram');
var ipaddr = require('ipaddr.js');

var config = require('./config');

var userCount = 0;

var socket = dgram.createSocket('udp4');

socket.on('message', function (message) {
	userCount = message.readUInt32BE(0);
});

socket.bind(config.user_counter.listen_host);

function addUser(address) {
	if (address.startsWith('[') && address.endsWith(']')) {
		address = address.slice(1, -1);
	}

	var addressBytes = Buffer.from(ipaddr.parse(address).toByteArray());
	var message;

	if (addressBytes.length === 4) {
		message = Buffer.alloc(16);
		message[10] = 0xff;
		message[11] = 0xff;
		addressBytes.copy(message, 12);
	} else {
		message = addressBytes;
	}

	socket.send(message, config.user_counter.port, config.user_counter.host);
}

exports.middleware = function (req, res, next) {
	if (req.forwarded.for) {
		addUser(req.forwarded.for);
	}

	req.userCount = userCount;
	next();
};
