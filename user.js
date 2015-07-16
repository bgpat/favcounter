'use strict';

var db = require('./db');

var User = function(arg, cb) {
  cb = cb || function(){};
  if (this == null) {
    var user = new User(arg, err => {
      cb(err, err || user);
    });
    return user;
  }
  if (typeof arg === 'string' || typeof arg === 'number') {
    this.uid = arg;
    return this.pull(cb);
  }
  arg = arg || {};
  this.uid = arg.uid;
  this.accounts = arg.accounts || [];
  this.config = arg.config;
};
module.exports = User;

User.prototype.pull = function(cb) {
  cb = cb || function(){};
  db.hget('user', this.uid, ((err, user) => {
    if (err) { return cb(err); }
    if(user != null) {
      this.constructor(JSON.parse(user));
    }
    cb(err);
  }).bind(this));
};

User.prototype.push = function(cb) {
  cb = cb || function(){};
  if (this.uid == null) {
    return this.insert(cb);
  }
  db.hset('user', this.uid, JSON.stringify(this), cb);
};

User.prototype.insert = function(cb) {
  cb = cb || function(){};
  db.incr('uid', ((err, uid) => {
    if (err) { return cb(err); }
    this.uid = uid;
    this.push(cb);
  }).bind(this));
};

User.prototype.getAccounts = function(cb) {
  cb = cb || function(){};
  db.hmget('account', this.accounts, (err, accounts) => {
    var Account = require('./account');
    if (err) { return cb(err); }
    cb(err, accounts.map(a => Account(JSON.parse(a))));
  });
};

User.prototype.addAccount = function(account, cb) {
  cb = cb || function(){};
  if (this.accounts == null) {
    return this.pull((err => this.addAccount(account, cb)).bind(this));
  }
  if (this.accounts.indexOf(account.id) !== -1) {
    cb(null);
  } else if (account.uid !== this.uid && account.uid != null) {
    User(account.uid, ((err, user) => {
      account.uid = this.uid;
      user.removeAccount(account.id, (err => {
        this.addAccount(account, cb);
      }).bind(this));
    }).bind(this));
  } else {
    this.accounts.push(account.id);
    this.push(cb);
  }
};

User.prototype.removeAccount = function(id, cb) {
  cb = cb || function(){};
  if (this.accounts == null) {
    return this.pull((err => this.removeAccount(id, cb)).bind(this));
  }
  if (this.accounts.indexOf(id) === -1) {
    return cb(new Error('account not found'));
  }
  var accounts = this.accounts;
  accounts.splice(accounts.indexOf(id), 1);
  if (accounts.length) {
    this.push(cb);
  } else {
    db.hdel('user', this.uid, cb);
    this.uid = null;
  }
};