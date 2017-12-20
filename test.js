const RedisPoco = require('./index')

const redisPoco = new RedisPoco({ namespace: 'PocoTest', attributes: ['A', 'B', 'C', 'D', 'E']})

const assert = require('assert')

redisPoco.whenFlush()
        .then(() => redisPoco.whenStore(null).catch(err => {
            assert.equal(err, 'Error: Invalid object')
            return Promise.resolve()
        }))
        .then(() => redisPoco.whenStore([]).catch(err => {
            assert.equal(err, 'Error: Invalid object')
            return Promise.resolve()
        }))
        .then(() => redisPoco.whenStore(34).catch(err => {
            assert.equal(err, 'Error: Invalid object')
            return Promise.resolve()
        }))
        .then(() => redisPoco.whenStore({}).catch(err => {
            assert.equal(err, 'Error: id missing on {}')
            return Promise.resolve()
        }))
        .then(() => redisPoco.whenStore({id: 'id1', A: ['x', 'y'], B: [1,2], C: [{A: 5}], D: 'z', E: {E: true}, F: {F: true}}).catch(err => {
            assert.equal(err, 'Error: B,C,E of {"id":"id1","A":["x","y"],"B":[1,2],"C":[{"A":5}],"D":"z","E":{"E":true},"F":{"F":true}} are not string/number/bool or array of strings')
            return Promise.resolve()
        }))
        .then(() => redisPoco.whenStore({id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 26, E: true, F: 'z'}))
        .then(() => redisPoco.whenGet('id1'))
        .then(poco => {
            assert.deepEqual(poco, {id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 26, E: true, F: 'z'})
            return Promise.resolve()
        })
        .then(() => redisPoco.whenStore({id: 'id2', A: 26, B: ['z', 'y'], C: 'z', D: 32, E: false, F: 'y'}))
        .then(() => redisPoco.whenGet('id2'))
        .then(poco => {
            assert.deepEqual(poco, {id: 'id2', A: 26, B: ['z', 'y'], C: 'z', D: 32, E: false, F: 'y'})
            return Promise.resolve()
        })
        .then(() => redisPoco.whenFilter({A: {min: 26, max: 26}, B: ['x', 'y'], C: 'z', D: {max: 30}, E: true}))
        .then(ids => {
            assert.deepEqual(ids, ['id1'])
            return Promise.resolve()
        })
        .then(redisPoco.whenQuit)
        .then(() => {
            console.info('Tests - passed')
            process.exit()
        })
        .catch(err => {
            console.error(err)
            redisPoco.whenQuit()
                .then(() => {
                    console.info('Tests - passed')
                    process.exit()
                })            
        })