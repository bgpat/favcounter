'use strict';

var db = require('./db');

var Account = function(arg, cb) {
  cb = cb || function(){};
  if (this == null) {
    var account = new Account(arg, err => {
      cb(err, err || account);
    });
    return account;
  }
  if (typeof arg === 'string') {
    this.id = arg;
    return this.pull(cb);
  }
  arg = arg || {};
  this.token = arg.token;
  this.secret = arg.secret;
  this.id = arg.id;
  this.data = arg.data || [];
  this.uid = arg.uid;
};
module.exports = Account;

Account.prototype.pull = function(cb) {
  cb = cb || function(){};
  db.hget('account', this.id, ((err, account) => {
    if (err) { return cb(err); }
    if (account != null) {
      this.constructor(JSON.parse(account));
    }
    cb(err);
  }).bind(this));
};

Account.prototype.push = function(cb) {
  cb = cb || function(){};
  if (this.id == null) {
    cb(new Error('`id` is undefined'));
  };
  if (this.uid == null) {
    var User = require('./user');
    var user = new User();
    user.accounts.push(this.id);
    return user.push((err => {
      if (err) { return cb(err); }
      this.uid = user.uid;
      this.push(cb);
    }).bind(this));
  }
  db.hset('account', this.id, JSON.stringify(this), cb);
};

Account.prototype.remove = function(cb) {
  cb = cb || function(){};
  var User = require('./user');
  User(this.uid, ((err, user) => {
    if (err) { return cb(err); }
    user.removeAccount(this.id, (err => {
      if (err) { return cb(err); }
      db.hdel('account', this.id, (err, user) => {
        if (err) { return cb(err); }
        cb(err, user);
      });
    }).bind(this));
  }).bind(this));
};

Account.prototype.addData = function(data) {
  data.timestamp = Date.now();
  /* 新しいデータは前から */
  if (this.data == null) {
    this.data = [];
  }
  this.data.unshift(data);
  /* this.data = this.data.slice(0, config.account.dataLength); */
};
