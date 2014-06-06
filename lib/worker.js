var cluster = require('cluster')
  , log = require('npmlog')

log.heading = 'dean'

if (cluster.isMaster) {
  throw new Error('should only be invoked as cluster worker')
}

var heading = '['+process.pid+']'

var args = process.argv.splice(2)
var opts = {}
if (args[0]) {
  opts = JSON.parse(args[0])
}

opts.redis = {
  host: opts['redis-host'] || '127.0.0.1'
, port: opts['redis-port'] || 6379
}

if (opts['redis-db']) opts.redis.db = opts['redis-db']
if (opts['redis-path']) opts.redis.socket = opts['redis-path']
if (opts['redis-auth']) opts.redis.auth = opts['redis-auth']

var Dean = require('../')

var dean = new Dean(opts)

var started = false

dean.on('error', function(err) {
  log.error(heading, err)
})

dean.on('proxyError', function(err) {
  log.error(heading, 'proxy error', err)
})

function close() {
  log.warn(heading, 'worker closing')

  process.on('uncaughtException', function(e) {
    log.error(heading, 'uncaught exception', e)
  })

  var t = setTimeout(function() {
    if (process.connected) process.disconnect()
  }, 100)

  process.on('disconnect', function() {
    log.warn(heading, 'worker disconnected')
    clearTimeout(t)
  })
}

dean.on('close', close)

dean.listen(function() {
  log.info(heading, 'dean has danced')
})

process.on('message', function(msg) {
  if ('object' === typeof msg) {
    if (msg.hasOwnProperty('message') && msg.message === 'drones') {
      msg.drones.forEach(function(drone) {
        dean.addDrone(drone)
      })
    }
  } else {
    log.info(heading, 'worker received message', msg)
  }
})
