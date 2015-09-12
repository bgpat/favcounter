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
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

/* cron */
{
  var fetch = require('./fetch');
  var cb = function(){
    fetch(cb);
    User.getAll((err, users) => {
      if (err) { return console.error(err); }
      users.forEach(user => {
        if (user && user.config.tweet) {
          var tweet = require('./tweet');
          var tw = new tweet.Tweet(user, (err, res) => {
            console.log(user.uid, !err);
          });
        }
      });
    });
  };
  fetch(cb);
}

/* session */
app.use(expressSession({
  secret: config.server.session.secret,
  proxy: true,
  resave: false,
  saveUninitialized: true,
  key: config.server.session.key,
  store: new MemcachedStore({hosts: config.memcached.hosts})
}));
app.all('*', (req, res, next) => {
  var sess = req.session;
  if (sess.secret == null) {
    sess.secret = {};
  }
  if (sess.uid != null && sess.user == null) {
    return User(sess.uid, (err, user) => {
      if (err) { return next(err); }
      sess.uid = user.uid;
      sess.user = user.uid && user;
      sess.accounts = null;
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
  } else {
    sess.accounts = sess.accounts.map(a => Account(a));
  }
  next();
});

/* routing */
app.get('/', (req, res) => {
  res.render('index', {
    error: null,
    session: req.session,
    user: req.session.user,
    accounts: req.session.accounts,
    card: null
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

app.get('/user/:uid', (req, res, next) => {
  User(req.params.uid, (err, user) => {
    if (user.uid != null &&  user.config.public) {
      return user.getAccounts((err, accounts) => {
        var site = '@' + accounts[0].data.recent.screen_name;
        var title = site + ' のふぁぼかうんたー';
        res.render('user', {
          error: null,
          session: req.session,
          user: user,
          accounts: accounts,
          card: {
            site: site,
            title: title
          }
        });
      });
    }
    next(new Error('このページは存在しません'));
  });
});

app.get('/account/:id', (req, res, next) => {
  Account(req.params.id, (err, account) => {
    res.json(account.data.map(d => {
      return {
        date: new Date(d.timestamp) + '',
        fav: d.favourites_count
      };
    }));
  });
});

app.get('/callback', (req, res, next) => {
  if (req.query.denied) {
    return next(new Error('認証に失敗しました: アプリの連携を許可してください'));
  }
  var token = req.query.oauth_token;
  var secret = req.session.secret[token];
  var verifier = req.query.oauth_verifier;
  if (secret == null) {
    return next(new Error('認証に失敗しました: クッキーを削除して再度お試しください'));
  } else if (verifier == null) {
    return next(new Error('認証に失敗しました: 認証情報が不正です'));
  }
  delete req.session.secret[token];
  var uid = req.session.uid;
  var tw = new Twitter(token, secret, verifier, err => {
    if (err) { return next(err); }
    tw.verify((err, data) => {
      if (err) { return next(err); }
      /* 軽量化のために最新ツイートを削除 */
      delete data.status;
      Account(data.id_str, (err, account) => {
        if (err) { return next(err); }
        account.token = tw.token;
        account.secret = tw.secret;
        account.addData(data);
        if (uid == null) {
          req.session.regenerate(() => {
            account.push(err => {
              req.session.uid = account.uid;
              next();
            });
          });
        } else {
          if (account.uid == null) {
            account.uid = uid;
          }
          User.addAccount(uid, account, err => {
            req.session.user = null;
            req.session.accounts = null;
            account.push(next);
          });
        }
      });
    });
  });
});

app.post('/sort', (req, res, next) => {
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
      if (account.uid !== req.session.uid) {
        return next(new Error('アカウント情報が不正です'));
      }
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

app.post('/config', (req, res, next) => {
  if (typeof req.body !== 'object') {
    return next(new Error('設定情報が不正です'));
  }
  User(req.session.uid, (err, user) => {
    user.config = {
      format: req.body.format || config.user.format,
      tweet: !!req.body.tweet,
      public: !!req.body.public
    };
    req.session.user = user;
    user.push(err => {
      if (err) { return next(err); }
      res.contentType('json');
      res.end(JSON.stringify(user));
    });
  });
});

app.post('/parse', (req, res, next) => {
  if (typeof req.body !== 'object') {
    return next(new Error('設定情報が不正です'));
  }
  var tweet = require('./tweet');
  var parse = require('./parse');
  var sess = req.session;
  var data = tweet.toData(sess.accounts, sess.user);
  console.dir(data, {depth: 10});
  res.json({
    text: parse(req.body.format, data)
  });
});

app.get('*', (req, res) => res.redirect('/'));

/* error */
app.use('*', (err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500);
  res.render('index', {
    error: err.message,
    session: req.session,
    user: req.session.user,
    accounts: req.session.accounts,
    card: null
  });
});

/* listen */
app.listen(config.server.socket);
