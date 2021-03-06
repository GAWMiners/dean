# dean
[![Build Status](https://circleci.com/gh/GAWMiners/dean.png?circle-token=ca1a2feb220cc3f7e4cf02228ca08f87b102cc83)](https://circleci.com/gh/GAWMiners/dean)

### Author
Evan Lucas

### License
MIT

## Installation
```bash
$ npm install -g dean
```

## Tests
```bash
$ npm test
```

## Coverage
```bash
$ npm run cover
```

## API

### Dean

Constructor

_opts_ can contain the following:

| Key | Description |
| --- | ----- |
| key | The session id (`connect.sid`) _can also pass session-key_ |
| bindAddress | The ip to bind (`0.0.0.0`) |
| port | The listening port (`8040`) |
| https | https options (`key`, `cert`) |
| timeout | Proxy timeout (`0`) |
| max-sockets | Max number of sockets for the http agent |
| redis | Object containing redis options (`port`, `host`, `socket`, `db`) |
| trace | `jstrace` instance |

**redis note**: the `redis` key can also contain a `redisClient`. This
should be an instance of `redis.createClient`. `redis.socket` will
take priority over `redis.host` and `redis.port`.

##### Params
| Name | Type(s) | Description |
| ---- | ------- | ----------- |
| opts | Object | The options |


***

### Dean.listen()

Listen for requests

Examples:

```js
// just a callback
dean.listen(function() {
  console.log('listening on port', dean.port)
})

// with a port
dean.listen(8044, function() {
  console.log('listening on port', 8044)
})

// with a port and host
dean.listen(8044, '127.0.0.1', function() {
  console.log('listening at', '127.0.0.1:8044')
})
```

##### Params
| Name | Type(s) | Description |
| ---- | ------- | ----------- |
| port | Number | The port on which we should listen (optional) |
| host | String | The bindAddress (optional) |
| cb | Function | function() |


***

### Dean.close()

Closes the server and stops accepting requests

##### Params
| Name | Type(s) | Description |
| ---- | ------- | ----------- |
| cb | Function | function() |


***

### Dean.addDrone()

Adds a new drone to the rotation

Example

```js
// all of the following will be accepted
// '0.0.0.0:4043'
dean.addDrone('0.0.0.0:4043')
dean.addDrone('4043')
dean.addDrone(4043)
dean.addDrone({
  port: 4043
, host: '0.0.0.0'
})
```

##### Params
| Name | Type(s) | Description |
| ---- | ------- | ----------- |
| drone | String, Object, Number | The drone to add |


***

### Dean.removeDrone()

Removes a drone from the rotation

Example

```js
dean.removeDrone('0.0.0.0:4043')
```

##### Params
| Name | Type(s) | Description |
| ---- | ------- | ----------- |
| drone | String | The drone to remove |


***
## Instrumentation

Instrumentation is optional via [jstrace](https://github.com/jstrace/jstrace).

The following probes are exposed:

- `dean:proxy:web:start`
  - `target` will be the request's target
  - `method` will be the request method
  - `url` will be the request url
- `dean:proxy:web:end`
  - `target` will be the request's target
  - `method` will be the request method
  - `url` will be the request url
  - `duration` will be the duration of the request in ms
- `dean:drone:add`
  - `drone` will be the added drone
- `dean:drone:remove`
  - `drone` will be the removed drone

An example script has been provided at `./scripts/trace.js`. To test it out:

```bash
$ jstrace ./scripts/trace.js

# Then in another terminal
$ npm test
```
