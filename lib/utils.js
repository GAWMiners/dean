var cookie = require('cookie')
  , utils = exports

utils.getSession = function(str, key) {
  str = str || ''
  var cookies = cookie.parse(str)
  return cookies[key]
}
