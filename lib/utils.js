var cookie = require('cookie')
  , redis = require('redis')
  , debug = require('debug')('dean:utils')
  , utils = exports

utils.parseCookies = function(str, key) {
  str = str || ''
  var cookies = cookie.parse(str)
  debug('parse cookies %j', cookies)
  if (key) return cookies[key]
  return cookies
}

// options
// {
//   redis: {
//     socket: '/tmp/redis.sock'
//   , host: '127.0.0.1'
//   , port: 6379
//   , db: 0
//   , auth: 'password'
//   }
//   redisClient: require('redis').createClient()
// }
utils.redisClient = function(options, cb) {
  var client
  var opts = options.redis || {}
  if (options.redisClient) {
    debug('using supplied redis client')
    client = options.redisClient
    return cb(null, client)
  } else {
    if (opts.socket) {
      debug('redis client connecting via unix_domain_socket %s', opts.socket)
      client = redis.createClient(opts.socket, opts)
    }
    var host = opts.host || '127.0.0.1'
    var port = opts.port || 6379
    debug('redis client connecting via %s:%s', host, port)
    client = redis.createClient(port, host, opts)
    auth(client, function(err) {
      if (err) return cb(err)
      select(client, cb)
    })
  }

  function auth(client, cb) {
    if (opts.password) {
      debug('redis client authenticating')
      client.auth(opts.password, function(err) {
        if (err) return cb && cb(err)
        cb(null, client)
      })
    } else {
      cb(null, client)
    }
  }

  function select(client, cb) {
    if (opts.db) {
      debug('redis client selecting db %d', opts.db)
      client.select(opts.db, function(err) {
        if (err) return cb(err)
        return cb(null, client)
      })
    } else {
      cb(null, client)
    }
  }
}
