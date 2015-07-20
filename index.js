#!/usr/bin/node
'use strict';

/* includes */
var http = require('http');
var express = require('express');
var ejs = require('ejs');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var MemcachedStore = require('connect-memcached')(expressSession);
var Twitter = require('./twitter');
var Account = require('./account');
var User = require('./user');
var config = require('./config');

/* config */
var app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(bodyParser.json());
app.use(expressSession({
  secret: config.server.session.secret,
  proxy: true,
  resave: false,
  saveUninitialized: true,
  key: config.server.session.key,
  store: new MemcachedStore({hosts: config.memcached.hosts})
}));
app.use(express.static(__dirname + '/public'));

/* routing */
app.get('*', (req, res, next) => {
  var sess = req.session;
  if (sess.secret == null) {
    sess.secret = {};
  }
  if (sess.uid != null && sess.user == null) {
    return User(sess.uid, (err, user) => {
      if (err) { return next(err); }
      sess.uid = user.uid;
      sess.user = user.uid && user;
      next();
    });
    sess.user = null;
  }
  next();
}, (req, res, next) => {
  var sess = req.session;
  if (sess.user == null) {
    sess.accounts = null;
  } else if (sess.accounts == null) {
    return User(sess.user).getAccounts((err, accounts) => {
      if (err) {
        sess.user = null;
        return next();
      }
      sess.accounts = accounts;
      next();
    });
  }
  next();
});

app.get('/', (req, res) => {
  res.render('index', {
    error: null,
    session: req.session
  });
});

app.get('/reload', (req, res, next) => {
  req.session.user = null;
  req.session.accounts = null;
  next();
});

app.get('/login', (req, res) => {
   Twitter.getAuthorizeUrl((err, url, token, secret) => {
    req.session.secret[token] = secret;
    res.redirect(url);
  });
});

app.get('/logout', (req, res, next) => {
  req.session.destroy();
  next();
});

app.get('/callback', (req, res, next) => {
  if (req.query.denied) {
    return next(new Error('oauth denied'));
  }
  var token = req.query.oauth_token;
  var secret = req.session.secret[token];
  var verifier = req.query.oauth_verifier;
  if (secret == null) {
    return next(new Error('secret is null'));
  } else if (verifier == null) {
    return next(new Error('verifier is null'));
  }
  delete req.session.secret[token];
  var tw = new Twitter(token, secret, verifier, err => {
    if (err) { return next(err); }
    tw.verify((err, data) => {
      if (err) { return next(err); }
      delete data.status;
      tw.id = data.id_str;
      var account = new Account(tw);
      account.pull((err => {
        if (err) { return next(err); }
        this.data = data;
        this.last = Date.now();
        if (req.session.uid == null) {
          this.push((err => {
            req.session.uid = this.uid;
            next();
          }).bind(this));
        } else {
          if (this.uid == null) {
            this.uid = req.session.uid;
          }
          User(req.session.uid, ((err, user) => {
            user.addAccount(this, (err => {
              req.session.user = null;
              req.session.accounts = null;
              this.push(next);
            }).bind(this));
          }).bind(this));
        }
      }).bind(account));
    });
  });
});

app.post('/update', (req, res, next) => {
  if (req.body && req.body.accounts != null) {
    var accounts = req.body.accounts;
    accounts = accounts.filter((a, i) => {
      return accounts.indexOf(a) === i;
    });
    return User(req.session.uid, (err, user) => {
      if (err) { return next(err); }
      if (accounts.length === user.accounts.length && 
        accounts.every(a => ~user.accounts.indexOf(a))) {
        user.accounts = accounts;
        req.session.accounts = null;
        req.session.user = user;
        return user.push(err => {
          if (err) { return next(err); }
          res.contentType('json');
          res.end(JSON.stringify(accounts));
        });
      }
      next(new Error('アカウント情報が不正です'));
    });
  }
  next(new Error('アカウント情報が不正です'));
});

app.post('/remove', (req, res, next) => {
  if (req.body && req.body.id != null) {
    var id = req.body.id;
    return Account(id, (err, account) => {
      if (err) { return next(err); }
      account.remove(err => {
        if (err) { return next(err); }
        req.session.accounts = null;
        req.session.user = null;
        res.contentType('json');
        res.end(JSON.stringify(account));
      });
    });
  }
  next(new Error('アカウント情報が不正です'));
});

  app.get('*', (req, res) => res.redirect('/'));

  /* error */
  app.use('*', (err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500);
    res.render('index', {
      error: err.message,
      session: req.session
    });
  });

  /* listen */
  app.listen(config.server.socket);
