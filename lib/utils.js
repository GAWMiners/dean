var cookie = require('cookie')
  , debug = require('debug')('dean:utils')
  , utils = exports

utils.parseCookies = function(str, key) {
  str = str || ''
  var cookies = cookie.parse(str)
  debug('parse cookies %j', cookies)
  if (key) return cookies[key]
  return cookies
}
