'use strict';

const fs = require('fs');
const path = require('path');
const toml = require('toml');

const configPath = path.join(__dirname, '../config/config.toml');
const config = toml.parse(fs.readFileSync(configPath, 'utf8'));

module.exports = config;
