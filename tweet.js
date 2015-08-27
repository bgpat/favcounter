'use strict';

var Account = require('./account');
var parse = require('./parse');
var config = require('./config');

/* ディープコピー */
function copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* アカウントデータを使いやすく変換 */
exports.toData = function(accounts, user) {
  accounts = copy(accounts);
  var first = Account(accounts.shift());
  var firstData = first.getData();
  var now = firstData[0];
  var prev = firstData[1] || now;
  accounts.forEach(a => {
    var d = Account(a).getData();
    if (d.length >= 0) {
      now.favourites_cont += d[0].favourites_count || 0;
      now.statuses_count += d[0].statuses_count || 0;
      now.friends_count += d[0].friends_count || 0;
      now.followers_count += d[0].followers_count || 0;
    }
    if (d.length >= 1) {
      prev.favourites_count += d[1].favourites_count || 0;
      prev.statuses_count += d[1].statuses_count || 0;
      prev.friends_count += d[1].friends_count || 0;
      prev.followers_count += d[1].followers_count || 0;
    }
  });
  return {
    id: first.data[0].screen_name,
    tag: config.user.tag,
    url: exports.url(user.uid),
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
