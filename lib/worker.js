var cluster = require('cluster')
  , log = require('npmlog')

log.heading = 'dean'

if (cluster.isMaster) {
  throw new Error('should only be invoked as cluster worker')
}

var heading = '['+process.pid+']'

var args = process.argv.splice(2)
var opts = {}
if (args[0]) opts.port = args[0]
if (args[1]) opts.bindAddress = args[1]
if (args[2]) opts.key = args[2]

var Dean = require('../')

var dean = new Dean(opts)

var started = false

dean.on('error', function(err) {
  log.error(heading, 'proxy error', err)
})

dean.on('start', function() {
  log.info(heading, 'dean has danced')
  started = true
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

setTimeout(function() {
  if (!started) dean.start()
}, 600)

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
