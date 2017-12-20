# redis-poco
Stores objects in redis with filtering on attributes

[![Build Status](https://travis-ci.org/recipeshelf/redis-poco.png?branch=master)](https://travis-ci.org/recipeshelf/redis-poco)

[![NPM](https://nodei.co/npm/redis-poco.png?downloads=true)](https://www.npmjs.com/package/redis-poco)

## Installation

npm install redis-poco

## Usage

```
const RedisPoco = require('redis-poco')

const redisPoco = new RedisPoco({ 
    port: 6379, 
    host: 'localhost', 
    idAttribute: 'id',
    itemKey: 'Item',
    operatingSetsExpireSeconds: 60,
    namespace: 'PocoTest', 
    attributes: ['A', 'B', 'C', 'D', 'E']
})

redisPhraseComplete.whenStore({id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 26, E: true, F: 'z'})
            .then(() => redisPhraseComplete.whenStore({id: 'id2', A: 26, B: ['z', 'y'], C: 'z', D: 32, E: false, F: 'y'}))
            .then(() => redisPhraseComplete.whenFilter({A: {min: 26, max: 26}, B: ['x', 'y'], C: 'z', D: {max: 30}, E: true}))
            .then(console.log)
            .then(redisPhraseComplete.whenQuit)                   
```
## Api

### new RedisPoco(options)

If options aren't passed, it uses defaults.

- port: Port address for the redis instance. The default is 6379.
- host: The hostname for the redis instance. The default is localhost.
- namespace: The namespace used for the poco keys. The default is 'Poco'.
- idAttribute: The id attribute of the object being stored. The default is 'id'.
- itemKey: The key under which the actual object json is store. The default is 'Item'.
- operatingSetsExpireSeconds: Temporary sets when filtering are expired after this interval. The default is 60.
- client: Use to pass in your own client.
- attributes: The attributes on which you are filtering. There are certain restrictions like they can only hold simple string, number or boolean or an array of strings.

### whenStore(poco)

Adds the poco object and indexes it.

### whenGet(id)

Gets the poco object from the store.

### whenGetAttributeValues(attribute)

Use this to get the distinct bucket values for the attribute.

### whenFilter(filter)

Returns all ids according to the filter. Note that numeric filters are specified as redis ranges. Ex: { min: 25, max: 32 }

### whenQuit()

Call this to quit the redis connection when you are done unless you are passing in your own client.
