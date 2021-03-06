require('https').globalAgent.options.rejectUnauthorized = false
var Dean = require('../')
  , should = require('should')
  , http = require('http')
  , io = require('socket.io')
  , ioc = require('socket.io-client')
  , debug = require('debug')('dean:test')
  , redis = require('redis')
  , utils = require('../lib/utils')
  , fs = require('fs')
  , path = require('path')

var httpsKey = fs.readFileSync(path.join(__dirname, 'fixtures', 'key.pem'))
var httpsCert = fs.readFileSync(path.join(__dirname, 'fixtures', 'cert.pem'))
var httpsOpts = {
  key: httpsKey
, cert: httpsCert
}

var sioOpts = {
  forceNew: true
, transports: ['websocket']
}

describe('dean', function() {
  describe('proxy https', function() {
    beforeEach(function(done) {
      var count = 0

      function next() {
        count++
        if (count === 2) done()
      }

      this.dean = Dean({
        key: 'connect.sid'
      , https: httpsOpts
      })

      var self = this

      this.server1 = require('./fixtures/server')()
      this.server2 = require('./fixtures/server')()
      this.io1 = io(this.server1)
      this.io2 = io(this.server2)
      this.server1.listen(0, function() {
        this.port1 = this.server1.address().port
        debug('starting server 1 on port %d', this.port1)
        this.dean.addDrone('0.0.0.0:'+this.port1)
        next()
      }.bind(this))
      this.server2.listen(0, function() {
        this.port2 = this.server2.address().port
        debug('starting server 2 on port %d', this.port2)
        this.dean.addDrone('0.0.0.0:'+this.port2)
        next()
      }.bind(this))

      this.io1.sockets.on('connection', function(socket) {
        socket.on('here', function(data) {
          socket.emit('test', self.port1)
        })
      })

      this.io2.sockets.on('connection', function(socket) {
        socket.on('here', function(data) {
          socket.emit('test', self.port2)
        })
      })
    })

    afterEach(function(done) {
      var count = 0
      function next() {
        count++
        if (count === 3) done()
      }
      this.server1.close(next)
      this.server2.close(next)
      this.dean.close(next)
    })

    it('should work with websockets', function(done) {
      this.timeout(10000)
      this.dean.listen(function() {
        var socket = ioc('https://localhost:'+this.dean.port, sioOpts)
        var self = this
        setTimeout(function() {
          socket.emit('here')
        }, 600)

        socket.on('connect_error', function(err) {
          console.log('connect_error', err)
        })

        socket.on('test', function(data) {
          var r = new RegExp(self.port1+'|'+self.port2)
          data.should.match(r)
          socket.disconnect()
          done()
        })
      }.bind(this))
    })

    it('should allow specifying port in listen', function(done) {
      this.timeout(5000)
      this.dean.listen(8045, function() {
        var socket = ioc('https://localhost:'+this.dean.port, sioOpts)
        var self = this
        setTimeout(function() {
          socket.emit('here')
        }, 600)

        socket.on('connect_error', function(err) {
          console.log('connect_error', err)
        })

        socket.on('test', function(data) {
          var r = new RegExp(self.port1+'|'+self.port2)
          data.should.match(r)
          socket.disconnect()
          done()
        })
      }.bind(this))
    })
  })

  describe('proxy', function() {
    beforeEach(function(done) {
      var count = 0

      function next() {
        count++
        if (count === 2) done()
      }

      this.dean = Dean({
        key: 'connect.sid'
      , trace: require('jstrace')
      })

      var self = this

      this.server1 = require('./fixtures/server')()
      this.server2 = require('./fixtures/server')()
      this.io1 = io(this.server1)
      this.io2 = io(this.server2)
      this.server1.listen(0, function() {
        this.port1 = this.server1.address().port
        debug('starting server 1 on port %d', this.port1)
        this.dean.addDrone('0.0.0.0:'+this.port1)
        next()
      }.bind(this))
      this.server2.listen(0, function() {
        this.port2 = this.server2.address().port
        debug('starting server 2 on port %d', this.port2)
        this.dean.addDrone('0.0.0.0:'+this.port2)
        next()
      }.bind(this))

      this.io1.sockets.on('connection', function(socket) {
        socket.on('here', function(data) {
          socket.emit('test', self.port1)
        })
      })

      this.io2.sockets.on('connection', function(socket) {
        socket.on('here', function(data) {
          socket.emit('test', self.port2)
        })
      })
    })

    afterEach(function(done) {
      var count = 0
      function next() {
        count++
        if (count === 3) done()
      }
      this.server1.close(next)
      this.server2.close(next)
      this.dean.close(next)
    })

    it('should work with websockets', function(done) {
      this.timeout(5000)
      this.dean.listen(function() {
        var socket = ioc('http://localhost:'+this.dean.port)
        var self = this
        socket.on('connect', function() {
          setTimeout(function() {
            socket.emit('here')
          }, 600)
        })

        socket.on('connect_error', function(err) {
          console.log('connect_error', err)
        })

        socket.on('test', function(data) {
          var r = new RegExp(self.port1+'|'+self.port2)
          data.should.match(r)
          socket.disconnect()
          done()
        })
      }.bind(this))
    })

    it('should allow specifying port in listen', function(done) {
      this.timeout(5000)
      this.dean.listen(8045, function() {
        var socket = ioc('http://localhost:'+this.dean.port)
        var self = this
        socket.on('connect', function() {
          setTimeout(function() {
            socket.emit('here')
          }, 600)
        })

        socket.on('connect_error', function(err) {
          console.log('connect_error', err)
        })

        socket.on('test', function(data) {
          var r = new RegExp(self.port1+'|'+self.port2)
          data.should.match(r)
          socket.disconnect()
          done()
        })
      }.bind(this))
    })
  })

  describe('errors', function() {
    it('should emit a proxyError event', function(done) {
      this.timeout(15000)
      var dean = new Dean({
        timeout: 5
      , trace: require('jstrace')
      })
      dean.on('proxyError', function(err) {
        debug('proxyError %j', err)
        should.exist(err)
        err.should.have.property('code', 'ECONNREFUSED')
        dean.close(done)
      })

      dean.on('error', function(err) {
        debug('error %j', err)
      })

      dean.addDrone(45645)

      dean.listen(function() {
        http.request({
          port: 8040
        }).on('error', function() {})
          .end()
      })
    })
  })

  describe('https', function() {
    it('should throw error if no key is provided', function() {
      (function() {
        var dean = Dean({
          https: {}
        })
      }).should.throw('https.key is required')
    })

    it('should throw error if no cert is provided', function() {
      (function() {
        var dean = Dean({
          https: {
            key: 'blah'
          }
        }).should.throw('https.cert is required')
      })
    })

    it('should work with key and cert', function() {
      var dean = Dean({
        https: httpsOpts
      })
    })
  })

  describe('drones', function() {
    it('can add a drone with just a port as a number', function(done) {
      var dean = Dean({
        trace: require('jstrace')
      })
      dean.listen(function() {
        dean.addDrone(5777)
        dean.drones.should.containEql('0.0.0.0:5777')
        dean.close(done)
      })
    })

    it('can add a drone with just a port as a string', function(done) {
      var dean = Dean({
        trace: require('jstrace')
      })
      dean.listen(function() {
        dean.addDrone('5777')
        dean.drones.should.containEql('0.0.0.0:5777')
        dean.close(done)
      })
    })

    it('can add a drone as a string', function(done) {
      var dean = Dean()
      dean.listen(function() {
        dean.addDrone('127.0.0.1:5666')
        dean.drones.should.containEql('127.0.0.1:5666')
        dean.close(done)
      })
    })

    it('should allow adding a drone as an object', function(done) {
      var dean = Dean()
      dean.listen(function() {
        dean.addDrone({
          port: 5777
        , host: '127.0.0.1'
        })
        dean.drones.should.containEql('127.0.0.1:5777')
        dean.close(done)
      })
    })

    it('can remove a drone', function(done) {
      var dean = Dean({
        trace: require('jstrace')
      })
      dean.listen(function() {
        var drone = '0.0.0.0:4567'
        dean.addDrone(drone)
        dean.drones.should.containEql(drone)
        dean.removeDrone(drone)
        dean.drones.should.have.length(0)
        dean.close(done)
      })
    })

    describe('subscriber', function() {
      it('should be able to add drones by publishing', function(done) {
        var dean = Dean()
        dean.listen(function() {
          var client = redis.createClient()
          var drone = '0.0.0.0:4567'

          dean.on('addDrone', function(d) {
            dean.drones.should.have.length(1)
            dean.drones.should.containEql(drone)
            client.quit()
            dean.close(done)
          })

          client.publish('dean', JSON.stringify({
            command: 'add'
          , drone: drone
          }))
        })
      })

      it('should be able to remove drones by publishing', function(done) {
        var dean = Dean()
        dean.listen(function() {
          var client = redis.createClient()
          var drone = '0.0.0.0:4567'

          dean.on('addDrone', function(d) {
            dean.drones.should.have.length(1)
            dean.drones.should.containEql(drone)
            client.publish('dean', JSON.stringify({
              command: 'remove'
            , drone: drone
            }))
          })

          dean.on('removeDrone', function(d) {
            dean.drones.should.have.length(0)
            client.quit()
            dean.close(done)
          })

          dean.addDrone(drone)

        })
      })
    })
  })

  describe('utils', function() {
    describe('parseCookies', function() {
      it('should return empty object for empty string', function() {
        var res = utils.parseCookies('')
        res.should.be.type('object')
        Object.keys(res).should.have.length(0)
      })

      it('should return an object if only a string is passed', function() {
        var res = utils.parseCookies('foo=bar; cat=meow; dog=ruff;')
        res.should.be.type('object')
        res.should.have.property('foo', 'bar')
        res.should.have.property('cat', 'meow')
        res.should.have.property('dog', 'ruff')
      })

      it('should return a string if a string and a key are passed', function() {
        var res = utils.parseCookies('foo=bar; cat=meow; dog=ruff;', 'dog')
        res.should.be.type('string')
        res.should.equal('ruff')
      })
    })

    describe('redisClient', function() {
      var testDb = 15
      it('should work with a custom redisClient', function(done) {
        var client = redis.createClient()
        utils.redisClient({
          redisClient: client
        }, function(err, client) {
          if (err) return done(err)
          should.exist(client)
          done()
        })
      })

      // circle doesn't currently support this out of the box
      it.skip('should work with a unix domain socket', function(done) {
        utils.redisClient({
          redis: {
            socket: '/tmp/redis.sock'
          }
        }, function(err, client) {
          if (err) return done(err)
          should.exist(client)
          done()
        })
      })

      // not really any way to test this without
      // manually configuring the server to require a pass
      it.skip('should work with a password', function(done) {
        var client = redis.createClient()
        client.send_command( 'config'
                           , ['set', 'requirepass', 'test']
                           , function(err, res) {
          if (err) return done(err)
          utils.redisClient({
            redis: { password: 'test' }
          }, function(err, client) {
            if (err) return done(err)
            should.exist(client)
            fix(client)
          })
        })

        function fix(client) {
          client.send_command( 'config'
                             , ['set', 'requirepass', '']
                             , function(err, res) {
            if (err) return done(err)
            done()
          })
        }
      })

      it('should allow selecting the db', function(done) {
        utils.redisClient({
          redis: { db: 3 }
        }, function(err, client) {
          if (err) return done(err)
          should.exist(client.selected_db, 'client should have selected db 3')
          client.selected_db.should.equal(3)
          done()
        })
      })
    })
  })
})
