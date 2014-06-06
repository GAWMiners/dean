#!/usr/bin/env node

var fs = require('fs')
  , nopt = require('nopt')
  , log = require('npmlog')
  , path = require('path')
  , net = require('net')
  , redis = require('redis')
  , Clache = require('clache')
  , archy = require('archy')
  , utils = require('../lib/utils')
  , knownOpts = { loglevel: ['verbose', 'warn', 'error', 'info', 'silent']
                , help: Boolean
                , version: Boolean
                , port: Number
                , 'bind-address': String
                , workers: Number
                , json: Boolean
                , key: String
                , 'max-sockets': Number
                , 'redis-db': Number
                , 'redis-host': String
                , 'redis-port': Number
                , 'redis-path': path
                , 'redis-auth': String
                }
  , shortHand = { verbose: ['--loglevel', 'verbose']
                , h: ['--help']
                , v: ['--version']
                , p: ['--port']
                , b: ['--bind-address']
                , w: ['--workers']
                , j: ['--json']
                , k: ['--key']
                , s: ['--max-sockets']
                }
  , parsed = nopt(knownOpts, shortHand)

var socket_addr = '/tmp/dean'

log.heading = 'dean'

if (parsed.loglevel) log.level = parsed.loglevel

parsed.workers = parsed.workers || require('os').cpus().length

if (parsed.help) {
  usage(0)
  return
}

if (parsed.version) {
  console.log('dean', 'v'+require('../package').version)
  return
}

var args = parsed.argv.remain

var command

if (args.length) {
  command = args.shift()
  switch (command) {
    case 'start':
      startServer()
      break
    case 'repl':
      startRepl()
      break
    case 'add':
      addDrone(args)
      break
    case 'remove':
    case 'rm':
      removeDrone(args)
      break
    case 'show':
      showDrones()
      break
    case 'help':
      usage(0)
      break
    default:
      usage(1)
      break
  }
} else {
  usage(1)
  return
}

function redis_opts() {
  var opts = {
    host: parsed['redis-host'] || '127.0.0.1'
  , port: parsed['redis-port'] || 6379
  }
  if (parsed['redis-db']) opts.db = parsed['redis-db']
  if (parsed['redis-path']) opts.socket = parsed['redis-path']
  if (parsed['redis-auth']) opts.password = parsed['redis-auth']
  return opts
}

function exit(code, pub, sub) {
  if (sub) {
    sub.unsubscribe()
    sub.quit()
  }
  if (pub) pub.quit()
  process.exit(code)
}

function startServer() {
  var cluster = require('cluster')
  var worker = require.resolve('../lib/worker')
  var config = {
    size: parsed.workers || 1
  }

  var redisOpts = redis_opts()
  var cache, sub
  var cache = new Clache(redisOpts)
  utils.redisClient({
    redis: redisOpts
  }, function(err, client) {
    sub = client
    sub.subscribe('dean')
    sub.on('message', function(channel, msg) {
      if (channel === 'dean') {
        // TODO: try/catch
        msg = JSON.parse(msg.toString())
        if (msg && msg.command === 'add') {
          drones.push(msg.drone)
          cache.set('dean_drones', drones, handle)
        } else if (msg && msg.command === 'remove') {
          var idx = drones.indexOf(msg.drone)
          if (~idx) {
            drones.splice(idx, 1)
          }
          cache.set('dean_drones', drones, handle)
        }
      }
    })
  })
  var drones

  function eachWorker(cb) {
    for (var id in cluster.workers) {
      cb(cluster.workers[id])
    }
  }

  cache.get('dean_drones', function(err, drones_) {
    if (err) {
      log.error('[drones]', 'error fetching drones', err)
      exit(1, null, sub)
    }
    drones = drones_ || []
    eachWorker(function(worker) {
      worker.send({
        message: 'drones'
      , drones: drones
      })
    })

    cluster.on('fork', function(worker) {
      worker.send({
        message: 'drones'
      , drones: drones
      })
    })
  })

  function handle(err) {
    if (err) {
      log.error('[drones]', 'error setting drones', err)
    }
  }

  config.exec = worker
  config.repl = socket_addr
  var port = parsed.port || 8040
  var ba = parsed['bind-address'] || '0.0.0.0'
  var key = parsed.key || 'connect.sid'
  config.args = [JSON.stringify(parsed)]

  var clusterMaster = require('cluster-master')
  clusterMaster(config)
}

function startRepl() {
  var sock = net.connect(socket_addr)

  process.stdin.pause()
  process.stdin.pipe(sock)
  sock.pipe(process.stdout)

  sock.on('connect', function() {
    process.stdin.resume()
    process.stdin.setRawMode(true)
  })

  process.stdin.on('end', function() {
    process.stdin.setRawMode(false)
    process.stdin.pause()
    sock.destroy()
    console.log()
  })

  process.stdin.on('data', function(b) {
    if (b.length === 1 && b[0] === 4) {
      process.stdin.emit('end')
    }
  })
}

function addDrone(args) {
  if (!args.length) {
    log.error('[add drone]', 'drone is required (ex. 0.0.0.0:4040)')
    process.exit(1)
  }

  var opts = {
    redis: redis_opts()
  }
  utils.redisClient(opts, function(err, client) {
    var drone
    var port = +args[0]
    if (isNaN(port)) drone = args[0]
    else drone = '0.0.0.0:'+args[0]
    log.info('adding drone', drone)
    client.publish('dean', JSON.stringify({
      command: 'add'
    , drone: drone
    }))
    setTimeout(function() {
      client.quit()
      process.exit()
    }, 1200)
  })
}

function removeDrone(args) {
  if (!args.length) {
    log.error('[remove drone]', 'drone is required (ex. 0.0.0.0:4040)')
    process.exit(1)
  }
  var opts = {
    redis: redis_opts()
  }
  utils.redisClient(opts, function(err, client) {
    var drone
    var port = +args[0]
    if (isNaN(port)) drone = args[0]
    else drone = '0.0.0.0:'+args[0]
    client.publish('dean', JSON.stringify({
      command: 'remove'
    , drone: drone
    }))
    setTimeout(function() {
      client.quit()
      process.exit()
    }, 1200)
  })
}

function showDrones() {
  var client = new Clache(redis_opts())

  function done() {
    process.exit()
  }
  client.get('dean_drones', function(err, drones) {
    if (err) {
      log.error('[drones]', 'error fetching drones', err)
      process.exit(1)
    }
    if (!drones.length) {
      log.info('[drones]', 'no drones registered')
      return done()
    }
    drones = drones.reduce(function(set, drone) {
      var splits = drone.split(':')
      var host = splits[0]
        , port = splits[1]

      if (!set.hasOwnProperty(host)) {
        set[host] = []
      }
      set[host].push(port)

      return set
    }, {})
    if (parsed.json) {
      console.log(JSON.stringify(drones))
      done()
    } else {
      var s = archy({
        label: 'drones'
      , nodes: Object.keys(drones).map(function(drone) {
          return {
            label: drone
          , nodes: drones[drone]
          }
        })
      })
      console.log(s)
      done()
    }
  })
}

function usage(code) {
  var rs = fs.createReadStream(__dirname + '/usage.txt')
  rs.pipe(process.stdout)
  rs.on('close', function() {
    if (code) process.exit(code)
  })
}
