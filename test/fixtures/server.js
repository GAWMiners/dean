var http = require('http')
  , https = require('https')
  , debug = require('debug')('dean:test:server')

module.exports = function(secure) {
  if (secure) {
    debug('starting https server')
    var server = https.createServer(secure, app)
    return server
  }
  debug('starting http server')
  var server = http.createServer(app)
  return server
}

function app(req, res) {
  debug('got request %s', req.url)
  var port = server.address().port
  res.writeHead(200, {
    'Content-Type': 'application/json'
  })
  res.end(JSON.stringify({
    port: port
  }))
}
