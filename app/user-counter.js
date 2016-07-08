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

	var message = Buffer.from(ipaddr.parse(address).toByteArray());
	socket.send(message, config.user_counter.port, config.user_counter.host);
}

exports.middleware = function (req, res, next) {
	if (req.forwarded.for) {
		addUser(req.forwarded.for);
	}

	res.locals.userCount = userCount;
	next();
};
