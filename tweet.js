'use strict';

var Account = require('./account');
var Data = require('./data');
var parse = require('./parse');
var Date = require('./date').Date;
var config = require('./config');

/* ディープコピー */
function copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* 合計を求める */
function sum(accounts, n, name) {
  return accounts.reduce((sum, account, i) => {
    var stat = account.data.statistics;
    var value = 0;
    if (stat.length > 0) {
      if (stat.length > n) {
        value = stat[n][name];
      } else {
        value = stat[stat.length - 1][name];
      }
    }
    return sum + value;
  }, 0);
}

/* アカウントデータを使いやすく変換 */
exports.toData = function(_accounts, user) {
  var accounts = copy(_accounts).map(a => Account(a));
  accounts.forEach((account, i) => {
    account.data = _accounts[i].data;
  });
  return {
    id: accounts[0].data.recent.screen_name,
    tag: config.user.tag,
    url: exports.url(user.uid),
    now: {
      fav: sum(accounts, 0, 'favourites_count'),
      tweet: sum(accounts, 0, 'statuses_count'),
      follow: sum(accounts, 0, 'friends_count'),
      follower: sum(accounts, 0, 'followers_count'),
      timestamp: accounts[0].data.last.timestamp
    },
    prev: {
      fav: sum(accounts, 1, 'favourites_count'),
      tweet: sum(accounts, 1, 'statuses_count'),
      follow: sum(accounts, 1, 'friends_count'),
      follower: sum(accounts, 1, 'followers_count'),
      timestamp: accounts[0].data.last.timestamp - Date.aday
    }
  };
};

/* ツイート内容を生成 */
exports.generate = function(accounts, user) {
  var data = exports.toData(accounts, user);
  return parse(user.config.format, data);
};

/* ユーザーページ */
exports.url = function(uid) {
  var date = Date.today.toString('YYYYMMDD');
  return config.user.url + 'user/' + uid + '/' + date;
};

/* ツイート */
exports.Tweet = function(user, cb) {
  cb = cb || function(){};
  user.getAccounts((err, accounts) => {
    if (err) { return console.error(err); }
    var text = exports.generate(accounts, user);
    var Twitter = require('./twitter');
    var first = Account(accounts.shift());
    var tw = new Twitter(first);
    tw.post('statuses/update', {status: text}, (err, res) => {
      if (err) {
        err.timestamp = Date.now.time;
        if (err.data != null) {
          err.data = JSON.parse(err.data);
        }
        first.errors.push(err);
        first.push();
      }
      cb(err, res);
    });
  });
};
