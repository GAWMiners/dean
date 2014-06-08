/**
 * Module depends
 */
var http = require('http')
  , https = require('https')
  , httpProxy = require('http-proxy')
  , domain = require('domain')
  , debug = require('debug')('dean')
  , EE = require('events').EventEmitter
  , util = require('util')
  , path = require('path')
  , url = require('url')
  , cookie = require('cookie')
  , pid = process.pid
  , utils = require('./utils')
  , redis = require('redis')
  , utile = require('core-util-is')

// export proxy
module.exports = Dean

/**
 * Constructor
 *
 * _opts_ can contain the following:
 *
 * | Key | Description |
 * | --- | ----- |
 * | key | The session id (`connect.sid`) |
 * | bindAddress | The ip to bind (`0.0.0.0`) |
 * | port | The listening port (`8040`) |
 * | timeout | Proxy timeout (`0`) |
 * | max-sockets | Max number of sockets for the http agent |
 * | redis | Object containing redis options (`port`, `host`, `socket`, `db`) |
 * | trace | `jstrace` instance |
 *
 * **redis note**: the `redis` key can also contain a `redisClient`. This
 * should be an instance of `redis.createClient`. `redis.socket` will
 * take priority over `redis.host` and `redis.port`.
 *
 * @param {Object} opts The options
 * @api public
 */
function Dean(opts) {
  if (!(this instanceof Dean))
    return new Dean(opts)

  EE.call(this)
  opts = opts || {}

  this.sessions = {}

  this.key = opts.key || null
  this.bindAddress = opts.bindAddress || '0.0.0.0'
  this.port = opts.port || 8040
  this.trace = opts.trace || function() {}

  this.drones = []

  opts.redis = opts.redis || {}
  utils.redisClient(opts, function(err, client) {
    this.subscriber = client
    this.subscriber.subscribe('dean')

    this.subscriber.on('message', function(channel, msg) {
      if (channel === 'dean') {
        // TODO: try/catch
        msg = JSON.parse(msg.toString())
        if (msg && msg.command === 'add') {
          debug('received pub to add drone %s', msg.drone)
          this.addDrone(msg.drone)
        } else if (msg && msg.command === 'remove') {
          debug('received pub to remove drone %s', msg.drone)
          this.removeDrone(msg.drone)
        }
      }
    }.bind(this))
  }.bind(this))

  var proxyOpts = { ws: true, xfwd: true }

  if (opts.timeout) proxyOpts.timeout = opts.timeout

  if (opts['max-sockets']) proxyOpts.agent = new http.Agent({
    maxSockets: opts['max-sockets']
  })

  var proxy = this.proxy = httpProxy.createServer(proxyOpts)

  var self = this

  function site(req, res) {
    var now = Date.now()
    var target = 'http://'+self.getDrone(req)
    debug('proxy %s', target)
    self.trace('dean:proxy:web:start', {
      target: target
    , method: req.method
    , url: req.url
    })

    req.on('end', function() {
      var diff = Date.now() - now
      self.trace('dean:proxy:web:end', {
        target: target
      , method: req.method
      , url: req.url
      , duration: diff
      })
    })
    proxy.web(req, res, {
      target: target
    })
  }

  proxy.on('error', function(err) {
    self.emit('proxyError', err)
  })

  function wrappedSite(req, res) {
    var d = domain.create()
    d.on('error', function(err) {
      self.emit('error', err)
    })

    d.run(function() {
      site(req, res)
    })
  }

  this.server = http.createServer(wrappedSite)

  this.server.on('upgrade', function(req, socket, head) {
    var target = 'http://'+self.getDrone(req)
    debug('proxy ws %s', target)
    self.trace('dean:proxy:ws:start', {
      target: target
    , method: req.method
    , url: req.url
    })
    proxy.ws(req, socket, head, {
      target: target
    })
  })
}

// inherit from EventEmitter
util.inherits(Dean, EE)

/**
 * Listen for requests
 *
 * Examples:
 *
 * ```js
 * // just a callback
 * dean.listen(function() {
 *   console.log('listening on port', dean.port)
 * })
 *
 * // with a port
 * dean.listen(8044, function() {
 *   console.log('listening on port', 8044)
 * })
 *
 * // with a port and host
 * dean.listen(8044, '127.0.0.1', function() {
 *   console.log('listening at', '127.0.0.1:8044')
 * })
 * ```
 *
 * @param {Number} port The port on which we should listen (optional)
 * @param {String} host The bindAddress (optional)
 * @param {Function} cb function()
 * @api public
 */
Dean.prototype.listen = function(port, host, cb) {
  if ('function' === typeof port) {
    cb = port
    port = this.port
    host = this.bindAddress
  } else if ('function' === typeof host) {
    cb = host
    host = this.bindAddress
  }

  if (utile.isNullOrUndefined(port)) port = this.port
  if (utile.isNullOrUndefined(host)) host = this.bindAddress

  this.port = port
  this.bindAddress = host

  if (utile.isFunction(cb)) {
    this.once('listening', cb)
  }
  debug('listen %d %s', port, host)
  this.server.listen(port, host, function() {
    this.emit('listening')
  }.bind(this))
}

/**
 * Closes the server and stops accepting requests
 *
 * @param {Function} cb function()
 * @api public
 */
Dean.prototype.close = function(cb) {
  if (utile.isFunction(cb)) {
    this.once('close', cb)
  }
  this.server.close(function() {
    debug('unsubscribe')
    this.subscriber.unsubscribe()
    this.subscriber.quit()
    debug('server closed')
    this.emit('close')
  }.bind(this))
}

/**
 * Adds a new drone to the rotation
 *
 * Example
 *
 * ```js
 * // all of the following will be accepted
 * // '0.0.0.0:4043'
 * dean.addDrone('0.0.0.0:4043')
 * dean.addDrone('4043')
 * dean.addDrone(4043)
 * dean.addDrone({
 *   port: 4043
 * , host: '0.0.0.0'
 * })
 * ```
 *
 * @param {String|Object|Number} drone The drone to add
 * @api public
 */
Dean.prototype.addDrone = function(drone) {
  if ('number' === typeof drone) {
    // number (4043)
    drone = this.bindAddress + ':' + drone
  } else if (utile.isObject(drone)) {
    // object { port: 4043, host: '0.0.0.0' }
    drone = (drone.host || this.bindAddress) + ':' + drone.port
  }
  if (!~drone.indexOf(':')) drone = this.bindAddress + ':' + drone
  // otherwise, we expect
  // string ('0.0.0.0:4043')
  debug('add drone %s', drone)
  this.trace('dean:drone:add', {
    drone: drone
  })
  this.drones.push(drone)
  this.emit('addDrone', drone)
}

/**
 * Removes a drone from the rotation
 *
 * Example
 *
 * ```js
 * dean.removeDrone('0.0.0.0:4043')
 * ```
 * @param {String} drone The drone to remove
 * @api public
 */
Dean.prototype.removeDrone = function(drone) {
  debug('remove drone %s', drone)
  this.trace('dean:drone:remove', {
    drone: drone
  })
  var idx = this.drones.indexOf(drone)
  if (~idx) {
    this.drones.splice(idx, 1)
    this.emit('removeDrone', drone)
  }
}

/**
 * Fetches the most logical drone for the given _req_
 *
 * TODO: Make private
 *
 * @param {IncomingRequest} req The request
 * @api private
 */
Dean.prototype.getDrone = function(req) {
  var cookies = utils.parseCookies(req.headers.cookie)

  var session = cookies[this.key]
  if (session) {
    debug('request has session')
    if (this.sessions.hasOwnProperty(session)) {
      debug('session %s', session)
      return this.sessions[session]
    }
    debug('caching session %s', session)
    this.sessions[session] = this.nextDrone()
  } else {
    var address = req.connection.address() || {}
    session = address.address
    if (session && this.sessions.hasOwnProperty(session)) {
      debug('address cached: %s', session)
      return this.sessions[session]
    }
    debug('caching address: %s', session)
    this.sessions[session] = this.nextDrone()
  }
  return this.sessions[session]
}

/**
 * Gets the next drone in the rotation
 *
 * TODO: Make private
 *
 * @api private
 */
Dean.prototype.nextDrone = function() {
  var drone = this.drones.shift()
  this.drones.push(drone)
  return drone
}
