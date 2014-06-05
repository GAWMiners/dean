var cookie = require('cookie')
  , utils = exports

utils.parseCookies = function(str, key) {
  str = str || ''
  var cookies = cookie.parse(str)
  if (key) return cookies[key]
  return cookies
}
