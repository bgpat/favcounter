'use strict';

var redis = require('redis');
var config = require('./config');

var client = redis.createClient(config.redis.socket);
client.on('error', e => e && console.error(e));
client.select(config.redis.db, e => e && console.error(e));
module.exports = client;
