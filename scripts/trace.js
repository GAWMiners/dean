var chalk = require('chalk')
  , util = require('util')

exports.local = function(traces) {

  traces.on('dean:proxy:web:end', function(trace) {
    console.log('proxy %s'
      , chalk.grey(trace.method)
      , trace.target
      , duration(trace.duration)
    )
  })

  traces.on('dean:drone:add', function(trace) {
    console.log('add drone %s', chalk.cyan(trace.drone))
  })

  traces.on('dean:drone:remove', function(trace) {
    console.log('remove drone %s', chalk.cyan(trace.drone))
  })
}

function duration(d) {
  if (+d > 1000) {
    return chalk.bold.white.bgRed.underline(util.format('(%s ms)', d))
  } else if (+d > 500) {
    return chalk.red(util.format('(%s ms)', d))
  } else if (+d > 250) {
    return chalk.yellow(util.format('(%s ms)', d))
  }
  return chalk.green(util.format('(%s ms)', d))
}
