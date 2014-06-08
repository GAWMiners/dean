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
