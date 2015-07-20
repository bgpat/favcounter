var OAuth = new require('oauth')
var config = require('./config.json');

var oauth = new OAuth.OAuth(
  config.oauth.urls.request,
  config.oauth.urls.access,
  config.oauth.key,
  config.oauth.secret,
  config.oauth.version,
  config.oauth.callback,
  config.oauth.method);

var Twitter = function(token, secret, verifier, callback) {
  if (token == null) {
    return null;
  }
  if (arguments.length === 1) {
    secret = token.secret;
    token = token.token;
  } else if (arguments.length > 2) {
    Twitter.getAccessToken(token, secret, verifier, ((err, token, secret) => {
      this.constructor(token, secret);
      callback(err);
    }).bind(this));
  }
  this.token = token;
  this.secret = secret;
};

Twitter.getRequestToken = function(callback) {
  oauth.getOAuthRequestToken(callback);
};

Twitter.getAuthorizeUrl = function(callback) {
  var url = config.oauth.urls.authorize;
  Twitter.getRequestToken((err, token, secret) => {
    if (err) {
      return callback(err);
    }
    url += '?oauth_token=' +  token;
    callback(err, url, token, secret);
  });
};
 
Twitter.getAuthenticateUrl = function(callback) {
  var url = config.oauth.urls.authenticate;
  Twitter.getRequestToken((err, token, secret) => {
    if (err) {
      return callback(err);
    }
    url += '?oauth_token=' +  token;
    callback(err, url, token, secret);
  });
};

Twitter.getAccessToken = function(token, secret, verifier, callback) {
  oauth.getOAuthAccessToken(token, secret, verifier, callback);
};

Twitter.prototype.get = function(path, data, callback) {
  if (arguments.length <= 2) {
    callback = data;
    data = null;
  }
  var url = config.oauth.urls.api + path + '.json';
  if (data != null) {
    url += '?';
    for (var key in data) {
      url += encodeURIComponent(key) + '=';
      url += encodeURIComponent(data[key]);
    }
  }
  oauth.get(
    url,
    this.token,
    this.secret,
    (err, data, res) => {
      callback && callback(err, JSON.parse(data), res);
    }
  );
};

Twitter.prototype.post = function(path, data, callback) {
  if (arguments.length <= 2) {
    callback = data;
    data = null;
  }
  oauth.post(
    config.oauth.urls.api + path + '.json',
    this.token,
    this.secret,
    data,
    (err, data, res) => {
      callback && callback(err, JSON.parse(data), res);
    }
  );
};

Twitter.prototype.verify = function(callback) {
  this.get('account/verify_credentials', callback);
};

module.exports = Twitter;
