# redis-poco
Stores objects in redis with filtering on attributes

[![Node.js CI](https://github.com/prasadtad/redis-poco/actions/workflows/nodejs.yml/badge.svg?branch=master)](https://github.com/prasadtad/redis-poco/actions/workflows/nodejs.yml)

[![npm version](https://img.shields.io/npm/v/redis-poco.svg)](https://www.npmjs.com/package/redis-poco)

## Installation

npm install redis-poco

## Usage

```js
const RedisPoco = require('redis-poco');

async function main() {
    const redisPoco = new RedisPoco({
        namespace: 'PocoTest',
        port: 6379,
        host: 'localhost',
        // endpoint: 'redis://localhost:6379', // optional alternative
        // client: yourOwnRedisClient, // optional
        idAttribute: 'id',
        itemKey: 'Item',
        operatingSetsExpireSeconds: 60,
        attributes: ['A', 'B', 'C', 'D', 'E']
    });

    await redisPoco.connect(); // Always connect before using unless you have passed in a connected client

    await redisPoco.whenStore({id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 26, E: true, F: 'z'});
    await redisPoco.whenStore({id: 'id2', A: 26, B: ['z', 'y'], C: 'z', D: 32, E: false, F: 'y'});
    const ids = await redisPoco.whenFilter({A: {min: 26, max: 26}, B: ['x', 'y'], C: 'z', D: {max: 30}, E: true});
    console.log(ids); // ['id1']
    await redisPoco.whenRemove('id2');
    await redisPoco.whenRemoveAll();
    await redisPoco.whenQuit();
}

main().catch(console.error);
```

## API (Promise-based, async/await friendly)


### new RedisPoco(options)

If options aren't passed, it uses defaults:

- `namespace`: The namespace used for the poco keys. Default: `'Poco'`.
- `port`: Redis port. Default: `6379`.
- `host`: Redis hostname. Default: `'localhost'`.
- `endpoint`: Full Redis endpoint URI (alternative to host/port).
- `client`: Pass your own Redis client (optional).
- `idAttribute`: The id attribute of the object. Default: `'id'`.
- `itemKey`: The key under which the object JSON is stored. Default: `'Item'`.
- `operatingSetsExpireSeconds`: Expiry for temporary sets when filtering. Default: `60`.
- `attributes`: The attributes on which you are filtering. Must be string, number, boolean, or array of strings.

### await redisPoco.connect()
Call this after instantiating to connect to Redis before using any methods.


### whenRemoveAll()
Removes all objects under the namespace.

### whenStore(poco)
Adds or updates the poco object and indexes it.


### whenRemove(id)
Removes the poco object and its indexes.

### whenGet(id)
Gets the poco object from the store.

### whenGetAttributeValues(attribute)
Returns the distinct values for the given attribute.

### whenFilter(filter)
Returns all ids matching the filter. Numeric filters are specified as `{ min, max }` ranges.

### whenQuit()
Call this to quit the Redis connection when you are done (unless you are passing your own client).
