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
    accounts: req.session.accounts
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
        res.render('user', {
          error: null,
          session: req.session,
          user: user,
          accounts: accounts
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
  var accounts = req.session.accounts.slice(0);
  var first = Account(accounts.shift());
  var firstData = first.getData();
  var now = JSON.parse(JSON.stringify(firstData[0]));
  var prev = JSON.parse(JSON.stringify(firstData[1]));
  accounts.forEach(a => {
    var d = Account(a).getData();
    if (d.length >= 0) {
      now.favourites_count += d[0].favourites_count;
      now.statuses_count += d[0].statuses_count;
      now.friends_count += d[0].friends_count;
      now.followers_count += d[0].followers_count;
    }
    if (d.length >= 1) {
      prev.favourites_count += d[1].favourites_count;
      prev.statuses_count += d[1].statuses_count;
      prev.friends_count += d[1].friends_count;
      prev.followers_count += d[1].followers_count;
    }
  });
  var data = {
    id: first.data[0].screen_name,
    tag: config.user.tag,
    url: config.user.url + 'user/' + req.session.user.uid,
    now: {
      fav: now.favourites_count,
      tweet: now.statuses_count,
      follow: now.friends_count,
      follower: now.followers_count,
      date: now.timestamp
    },
    prev: {
      fav: prev.favourites_count,
      tweet: prev.statuses_count,
      follow: prev.friends_count,
      follower: prev.followers_count,
      date: prev.timestamp
    }
  };
  res.contentType('json');
  res.end(JSON.stringify({
    text: require('./parse')(req.body.format, data)
  }));
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
    accounts: req.session.accounts
  });
});

/* listen */
app.listen(config.server.socket);
