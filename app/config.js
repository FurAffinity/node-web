'use strict';

var fs = require('fs');
var path = require('path');
var toml = require('toml');

var configPath = path.join(__dirname, '../config/config.toml');
var config = toml.parse(fs.readFileSync(configPath, 'utf8'));

module.exports = config;
