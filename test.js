var Twitter = require('./twitter');
var Account = require('./account');
var User = require('./user');
var db = require('./db');

Account.getAll((err, accounts) => {
  for (var i = 0; i < accounts.length;) {
    var tw = new Twitter(accounts[i]);
    var id = accounts.slice(i, i += 100).map(a => a.id);
    tw.get('users/lookup', {user_id: id.join(',')}, (err, data) => {
      console.log(data);
    });
  }
});
