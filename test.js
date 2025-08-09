
import RedisPoco from './index.js'
import { equal, deepEqual } from 'assert'

async function runTests() {
    const redisPoco = new RedisPoco({ namespace: 'PocoTest', attributes: ['A', 'B', 'C', 'D', 'E']})
    await redisPoco.connect()
    try {
        await redisPoco.whenFlush()
        try {
            await redisPoco.whenStore(null)
        } catch (err) {
            equal(err.message || err, 'Invalid object')
        }
        try {
            await redisPoco.whenStore([])
        } catch (err) {
            equal(err.message || err, 'Invalid object')
        }
        try {
            await redisPoco.whenStore(34)
        } catch (err) {
            equal(err.message || err, 'Invalid object')
        }
        try {
            await redisPoco.whenStore({})
        } catch (err) {
            equal(err.message || err, 'id missing on {}')
        }
        try {
            await redisPoco.whenStore({id: 'id1', A: ['x', 'y'], B: [1,2], C: [{A: 5}], D: 'z', E: {E: true}, F: {F: true}})
        } catch (err) {
            equal(err.message || err, 'B,C,E of {"id":"id1","A":["x","y"],"B":[1,2],"C":[{"A":5}],"D":"z","E":{"E":true},"F":{"F":true}} are not string/number/bool or array of strings')
        }
        await redisPoco.whenStore({id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 26, E: true, F: 'z'})
        let poco = await redisPoco.whenGet('id1')
        deepEqual(poco, {id: 'id1', A: 26, B: ['x', 'y'], C: 'z', D: 26, E: true, F: 'z'})
        await redisPoco.whenStore({id: 'id2', A: 26, B: ['z', 'y'], C: 'z', D: 32, E: false, F: 'y'})
        poco = await redisPoco.whenGet('id2')
        deepEqual(poco, {id: 'id2', A: 26, B: ['z', 'y'], C: 'z', D: 32, E: false, F: 'y'})
        let ids = await redisPoco.whenFilter({A: {min: 26, max: 26}, B: ['x', 'y'], C: 'z', D: {max: 30}, E: true})
        deepEqual(ids, ['id1'])
        await redisPoco.whenStore({id: 'id2', A: ['x'], B: 75, C: 34, E: true, F: 'x'})
        poco = await redisPoco.whenGet('id2')
        deepEqual(poco, {id: 'id2', A: ['x'], B: 75, C: 34, E: true, F: 'x'})
        await redisPoco.whenRemove('id1')
        poco = await redisPoco.whenGet('id1')
        equal(poco, null)
        ids = await redisPoco.whenFilter({A: 'x', B: {min: 60}, C: 34, E: true})
        deepEqual(ids, ['id2'])
        await redisPoco.whenRemoveAll()
        poco = await redisPoco.whenGet('id2')
        equal(poco, null)
        await redisPoco.whenQuit()
        console.info('Tests - passed')
        process.exit()
    } catch (err) {
        console.error(err)
        await redisPoco.whenQuit()
        console.info('Tests - failed')
        process.exit(1)
    }
}

runTests()
