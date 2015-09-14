var Twitter = require('./twitter');
var Account = require('./account');
var User = require('./user');
var db = require('./db');
var Date = require('./date').Date;

var fetch = function(cb, soon) {
  cb = cb || function(){};
  if (!soon) {
    var base = Date.today.nextDay().time - 1;
    return setTimeout(() => {
      fetch(cb, true);
    }, base - Date.now.time);
  }
  Account.getAll((err, accounts) => {
    for (var i = 0; i < accounts.length;) {
      var tw = new Twitter(accounts[i]);
      var id = accounts.slice(i, i += 100).map(a => a.id);
      tw.get('users/lookup', {user_id: id.join(',')}, (err, data) => {
        var len = data.length;
        data.forEach(d => {
          Account(d.id_str, (err, a) => {
            if (err) {
              len--;
              return console.error(err);
            }
            a.addData(d);
            a.push(err => {
              err && console.error(err);
              if (--len === 0) {
                cb();
              }
            });
          });
        });
      });
    }
  });
};

module.exports = fetch;
