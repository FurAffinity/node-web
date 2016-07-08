'use strict';

var bluebird = require('bluebird');
var redis = require('redis');

var config = require('./config');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var client = redis.createClient(config.redis);

exports.client = client;
