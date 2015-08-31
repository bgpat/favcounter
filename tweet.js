'use strict';

var Account = require('./account');
var Data = require('./data');
var parse = require('./parse');
var config = require('./config');

/* ディープコピー */
function copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* 合計を求める */
function sum(arr, fn) {
  return arr.reduce((a, b, c) => {
    return a + (Number(fn(b, c)) || 0);
  }, 0);
}

/* アカウントデータを使いやすく変換 */
exports.toData = function(accounts, user) {
  accounts = copy(accounts).map(a => Account(a));
  return {
    id: accounts[0].data.recent.screen_name,
    tag: config.user.tag,
    url: exports.url(user.uid),
    now: {
      fav: sum(
        accounts,
        a => a.data.statistics[0].favourites_count
      ),
      tweet: sum(
        accounts,
        a => a.data.statistics[0].statuses_count
      ),
      follow: sum(
        accounts,
        a => a.data.statistics[0].friends_count
      ),
      follower: sum(
        accounts,
        a => a.data.statistics[0].followers_count
      ),
      timestamp: accounts[0].data.last.timestamp
    },
    prev: {
      fav: sum(
        accounts,
        a => a.data.statistics[1].favourites_count
      ),
      tweet: sum(
        accounts,
        a => a.data.statistics[1].statuses_count
      ),
      follow: sum(
        accounts,
        a => a.data.statistics[1].friends_count
      ),
      follower: sum(
        accounts,
        a => a.data.statistics[1].followers_count
      ),
      timestamp: accounts[0].data.last.timestamp - (1000 * 60 * 60 * 24)
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
  return config.user.url + 'user/' + uid;
};

/* ツイート */
exports.Tweet = function(user) {
  user.getAccounts((err, accounts) => {
    if (err) { return console.error(err); }
    var text = exports.generate(accounts, user);
    var Twitter = require('./twitter');
    var tw = new Twitter(accounts.shift());
    tw.post('statuses/update', {status: text}, (err, res) => {
      console.log(err, res);
    });
  });
};
