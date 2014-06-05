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
| key | The session id (`connect.sid`) |
| bindAddress | The ip to bind (`0.0.0.0`) |
| port | The listening port (`8040`) |
| timeout | Proxy timeout (`0`) |
| max-sockets | Max number of sockets for the http agent |

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
