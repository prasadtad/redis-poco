const RedisPoco = require('./index')

const redisPoco = new RedisPoco({ namespace: 'PocoTest', attributes: ['A', 'B', 'C', 'D', 'E']})

const assert = require('assert')

const tests = []
tests.push(redisPoco.whenStore(null).catch(err => assert.equal(err, 'Error: Invalid object')))
tests.push(redisPoco.whenStore([]).catch(err => assert.equal(err, 'Error: Invalid object')))
tests.push(redisPoco.whenStore(34).catch(err => assert.equal(err, 'Error: Invalid object')))
tests.push(redisPoco.whenStore({}).catch(err => assert.equal(err, 'Error: id missing on {}')))
tests.push(redisPoco.whenStore({id: 'id1', A: ['x', 'y'], B: [1,2], C: [{A: 5}], D: 'z', E: {E: true}, F: {F: true}}).catch(err => {
    assert.equal(err, 'Error: B,C,E of {"id":"id1","A":["x","y"],"B":[1,2],"C":[{"A":5}],"D":"z","E":{"E":true},"F":{"F":true}} are not string/number or array of strings')
}))
tests.push(redisPoco.whenStore({id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 32, F: 'z'})
            .then(() => redisPoco.whenGet('id1')
            .then(poco => {
                assert.deepEqual(poco, {id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 32, F: 'z'})
            })))

redisPoco.whenFlush()
    .then(() => {
        return Promise.all(tests)
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
})