module.exports = {
  server: {
    socket: '/path/to/favcounter.sock',
    session: {
      secret: 'secret key',
      key: 'SESSION',
    }
  },
  memcached: {
    hosts: ['/path/to/memcached.sock']
  },
  redis: {
    socket: '/path/to/redis.sock',
    db: 0
  },
  oauth: {
    key: 'consumer key',
    secret: 'consumer secret key',
    callback: 'http://example.com/oauth/callback/url',
    version: '1.0A',
    method: 'HMAC-SHA1',
    urls: {
      request: 'https://api.twitter.com/oauth/request_token',
      authorize: 'https://twitter.com/oauth/authorize',
      authenticate: 'https://twitter.com/oauth/authenticate',
      access: 'https://api.twitter.com/oauth/access_token',
      api: 'https://api.twitter.com/1.1/'
    }
  }
};
