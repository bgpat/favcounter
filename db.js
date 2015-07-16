'use strict';

var redis = require('redis');
var config = require('./config');

var client = redis.createClient(config.redis.socket);
client.on('error', e => e && console.error(e));
client.select(config.redis.db, e => e && console.log(e));

var Account = function(oauth) {
  if (this == null) {
    var account = new Account({
      token: oauth.token,
      secret: oauth.secret
    });
    account.data = oauth.data;
    account.user = oauth.user;
    account.last = oauth.last;
    account.log = oauth.log;
    return account;
  }
  this.token = oauth.token;
  this.secret = oauth.secret;
  this.data = null;
  this.user = null;
  this.last = Date.now();
  this.log = [];
};

Account.fetch = function(oauth, cb) {
  var account =  new Account(oauth);
  return account.load(err => cb(err, account));
};

Account.prototype.load = function(cb) {
  cb = cb || ()=>{};
  return client.hget('account', this.token, ((err, res) => {
    if (err) {
      return cb(err);
    }
    if (res) {
      var account = JSON.parse(res);
      for (var key in account) {
        this[key] = account[key];
      }
    }
    cb(null, res);
  }).bind(this));
};

Account.prototype.save = function(cb) {
  cb = cb || ()=>{};
  if (this.user == null) {
    var user = new User();
    user.accounts.push(this.token);
    return user.save((err => {
      if (err) {
        cb(err);
      }
      this.user = user.id;
      this.save(cb);
    }).bind(this));
  }
  return client.hset('account', this.token, JSON.stringify(this), cb);
};

var User = function(id) {
  if (this == null) {
    return new User(id);
  }
  this.id = id;
  this.accounts = [];
  this.config = {};
};

User.fetch = function(id, cb) {
  var user = new User(id);
  return user.load(err => cb(err, user));
};

User.prototype.load = function(cb) {
  cb = cb || ()=>{};
  return client.hget('user', this.id, ((err, res) => {
    if (err) {
      return cb(err);
    }
    if (res) {
      var user = JSON.parse(res);
      for (var key in user) {
        this[key] = user[key];
      }
    }
    cb(null, res);
  }).bind(this));
};

User.prototype.save = function(cb) {
  cb = cb || ()=>{};
  if (this.id == null) {
    return client.incr('user_index', ((err, id) => {
      if (err) {
        return cb(err);
      }
      this.id = id;
      this.save(cb);
    }).bind(this));
  }
  return client.hset('user', this.id, JSON.stringify(this), cb);
};

User.prototype.add = function(token, cb) {
  cb = cb || ()=>{};
  return this.load((err => {
    if (err || this.accounts.indexOf(token) !== -1) {
      return cb(err);
    }
    this.accounts.push(token);
    this.save(cb);
  }).bind(this));
};

User.prototype.remove = function(token, cb) {
  cb = cb || ()=>{};
  return this.load((err => {
    var i = this.accounts.indexOf(token);
    if (err || ~i) {
      return cb(err);
    }
    this.accounts.splice(i, 1);
    this.save(cb);
  }).bind(this));
};

client.Account = Account;
client.User = User;
module.exports = client;
