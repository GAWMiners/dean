var http = require('http')

module.exports = function() {
  var server = http.createServer(app)
  return server
}

function app(req, res) {
  var port = server.address().port
  res.writeHead(200, {
    'Content-Type': 'application/json'
  })
  res.end(JSON.stringify({
    port: port
  }))
}
