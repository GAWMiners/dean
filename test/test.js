var proxy = require('../')({
  key: 'sessid'
, drones: [
    4043
  , 4048
  ]
})

proxy.start()
proxy.on('error', function(err) {
  throw err
})
