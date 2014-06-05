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

module.exports = Proxy

function Proxy(opts) {
  if (!(this instanceof Proxy))
    return new Proxy(opts)

  EE.call(this)
  opts = opts || {}

  this.sessions = {}

  this.key = opts.key || null
  this.bindAddress = opts.bindAddress || '0.0.0.0'
  this.port = opts.port || 8040

  this.drones = []

  this.subscriber = redis.createClient()

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

  var proxyOpts = { ws: true, xfwd: true }

  if (opts.timeout) proxyOpts.timeout = opts.timeout

  if (opts['max-sockets']) proxyOpts.agent = new http.Agent({
    maxSockets: opts['max-sockets']
  })

  var proxy = this.proxy = httpProxy.createServer(proxyOpts)

  var self = this

  function site(req, res) {
    var target = 'http://'+self.getDrone(req)
    debug('proxy %s', target)
    proxy.web(req, res, {
      target: target
    })
  }

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
    proxy.ws(req, socket, head, {
      target: target
    })
  })

  this.server.on('close', function() {
    this.subscriber.unsubscribe()
    this.subscriber.end()
    log.warn('[close]', pid, 'server closing')
    self.emit('close')
  })
}

util.inherits(Proxy, EE)

Proxy.prototype.start = function() {
  this.server.listen(this.port, this.bindAddress, function() {
    this.emit('start')
  }.bind(this))
}

Proxy.prototype.stop = function() {
  this.server.close()
}

Proxy.prototype.addDrone = function(drone) {
  log.verbose('[add drone]', drone)
  if ('string' === typeof drone) {
    // string ('0.0.0.0:4043')
    this.drones.push(drone)
  } else if ('number' === typeof drone) {
    // number (4043)
    this.drones.push(
      this.bindAddress + ':' + drone
    )
  } else {
    // object { port: 4043, host: '0.0.0.0' }
    this.drones.push(
      (drone.host || this.bindAddress) + ':' + drone.port
    )
  }
}

Proxy.prototype.removeDrone = function(drone) {
  var idx = this.drones.indexOf(drone)
  if (~idx) {
    this.drones.splice(idx, 1)
  }
}

Proxy.prototype.getDrone = function(session) {
  if (!session) {
    return this.nextDrone()
  }

  if (this.sessions.hasOwnProperty(session)) {
    return this.sessions[session]
  }

  this.sessions[session] = this.nextDrone()
  return this.sessions[session]
}

Proxy.prototype.nextDrone = function() {
  var drone = this.drones.shift()
  this.drones.push(drone)
  return drone
}
