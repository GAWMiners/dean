var Dean = require('../')
  , should = require('should')
  , http = require('http')
  , io = require('socket.io')
  , ioc = require('socket.io-client')
  , debug = require('debug')('dean:test')
  , redis = require('redis')

describe('dean', function() {
  describe('proxy', function() {
    beforeEach(function(done) {
      var count = 0

      function next() {
        count++
        if (count === 2) done()
      }

      this.dean = Dean({
        key: 'connect.sid'
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

  describe('drones', function() {
    it('can add a drone with just a port as a number', function(done) {
      var dean = Dean()
      dean.listen(function() {
        dean.addDrone(5777)
        dean.drones.should.containEql('0.0.0.0:5777')
        dean.close(done)
      })
    })

    it('can add a drone with just a port as a string', function(done) {
      var dean = Dean()
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
      var dean = Dean()
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
})
