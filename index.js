// index.js

import pkg from 'lodash';
const { bindAll, map, isObjectLike, isArray, reject, isNil, filter, isObject, uniq, difference, flattenDeep, union, join, forEach, isNumber, some } = pkg;
import { createClient } from 'redis'

export default class RedisPoco {
    constructor(options) {
        options = options || {}
        this.idAttribute = options.idAttribute || 'id'
        this.itemKey = options.itemKey || 'Item'
        this.attributes = options.attributes
        this.namespace = options.namespace || 'Poco'
        this.operatingSetsExpireSeconds = options.operatingSetsExpireSeconds || 60
        if (options.client) {
            this.client = options.client
        } else {
            this.client = createClient({
                url: options.endpoint || undefined,
                socket: options.host ? { host: options.host, port: options.port || 6379 } : undefined
            })            
        }
        bindAll(this, 'buildKey', 'whenFlush', 'whenRemoveAll', 'whenScan', 'whenGetAttributeValues', 'whenGet', 'whenFilter', 'whenSetOr', 'whenSetsAnd', 'whenRemove', 'whenStore', 'whenQuit')
    }

    buildKey(...suffix) {
        return this.namespace + ':' + suffix.join(':')
    }

    async connect() {
        return this.client.connect()
    }

    async whenFlush() { return this.client.flushDb() }

    async whenRemoveAll() {
        const keys = await this.whenScan('0', [], this.namespace + ':*')
        if (keys && keys.length > 0) {
            await this.client.del(...keys)
        }
    }

    async whenScan(cursor, results, pattern) {
        const args = [cursor, 'MATCH', pattern, 'COUNT', 100]
        const r = await this.client.scan(...args)
        results.push(...r.keys)
        if (r.cursor === '0') return results
        return this.whenScan(r.cursor, results, pattern)
    }

    async whenGetAttributeValues(attribute) {
        attribute = this.buildKey(attribute) + ':'
        const keys = await this.client.keys(attribute + '*')
        return map(keys, k => k.substring(attribute.length))
    }

    async whenGet(id) {
        const poco = await this.client.hGet(this.buildKey(this.itemKey), id)
        if (poco === null || poco === undefined) return null;
        return JSON.parse(poco)
    }

    async whenFilter(criteria) {
        if (!isObjectLike(criteria) || isArray(criteria)) throw new Error('Invalid filter')

        const validAttributes = reject(this.attributes, attribute => isNil(criteria[attribute]))
        const numericAttributes = filter(validAttributes, attribute => isObject(criteria[attribute]) && !isArray(criteria[attribute]))

        const whenRangeByScores = await Promise.all(
            map(numericAttributes, attribute => {
                let min = criteria[attribute].min !== undefined ? parseInt(criteria[attribute].min, 10) : '-inf';
                let max = criteria[attribute].max !== undefined ? parseInt(criteria[attribute].max, 10) : '+inf';
                if (min === '-inf') min = Number.MIN_SAFE_INTEGER;
                if (max === '+inf') max = Number.MAX_SAFE_INTEGER;
                return this.client.zRangeByScoreWithScores(
                    this.buildKey(attribute),
                    min,
                    max
                );
            })
        )

        const keyPromises = []
        let keys = []
        for (let i = 0; i < numericAttributes.length; i++) {
            if (!whenRangeByScores[i] || whenRangeByScores[i].length === 0) continue
            const idScorePairs = whenRangeByScores[i]
            const scores = uniq(idScorePairs.map(pair => pair.score))
            if (scores.length === 1)
                keys.push(this.buildKey(numericAttributes[i], scores[0]))
            else
                keyPromises.push(this.whenSetOr(this.buildKey(numericAttributes[i]), scores))
        }
        const k = await Promise.all(keyPromises)
        keys.push(
            difference(validAttributes, numericAttributes)
                .map(attribute => map(this.toArray(criteria[attribute]), v => this.buildKey(attribute, v)))
        )
        keys = flattenDeep(keys)
        const set = await this.whenSetsAnd(union(k, keys))
        const members = await this.client.sMembers(set)
        return members
    }

    async whenSetOr(setPrefix, setNames) {
        const setKeys = map(setNames, setName => this.buildKey(setPrefix, setName))
        const destination = setKeys.join('|')
        await this.client.sUnionStore(destination, setKeys)
        await this.client.expire(destination, this.operatingSetsExpireSeconds)
        return destination
    }

    async whenSetsAnd(setKeys) {
        const destination = setKeys.join('&')
        await this.client.sInterStore(destination, setKeys)
        await this.client.expire(destination, this.operatingSetsExpireSeconds)
        return destination
    }

    async whenRemove(id) {
        await this.whenStore({id: id})
        await this.client.hDel(this.buildKey(this.itemKey), id)
    }

    async whenStore(poco) {
        if (!isObjectLike(poco) || isArray(poco)) throw new Error('Invalid object')

        const id = poco[this.idAttribute]
        if (!id) throw new Error(this.idAttribute + ' missing on ' + JSON.stringify(poco))

        const invalidAttributes = reject(this.attributes, attribute => this.isAttributeValueValid(poco[attribute]))

        if (invalidAttributes.length > 0)
            throw new Error(join(invalidAttributes) + ' of ' + JSON.stringify(poco) + ' are not string/number/bool or array of strings')

        const oldPoco = await this.whenGet(id).catch(() => undefined)
        const multi = this.client.multi()
        multi.hSet(this.buildKey(this.itemKey), poco[this.idAttribute], JSON.stringify(poco))
        for (const attribute of this.attributes) {
            if (!isNil(oldPoco) && !isNil(oldPoco[attribute])) {
                forEach(this.toArray(oldPoco[attribute]), value => {
                    if (!isNil(value)) {
                        multi.sRem(this.buildKey(attribute, value), id)
                        multi.zRem(this.buildKey(attribute), id)
                    }
                })
            }
            if (!isNil(poco[attribute])) {
                forEach(this.toArray(poco[attribute]), value => {
                    if (!isNil(value)) {
                        multi.sAdd(this.buildKey(attribute, value), id)
                        if (isNumber(value)) {
                            const score = parseInt(value, 10);
                            multi.zAdd(this.buildKey(attribute), [{ score, value: id }]);
                        }
                    }
                })
            }
        }
        await multi.exec()
    }

    toArray(values) {
        if (!isArray(values)) values = [ values ]
        return values
    }
    
    isAttributeValueValid(attributeValue) {
        if (isArray(attributeValue)) return !some(attributeValue, v => isObject(v) || isNumber(v))
        return !isObject(attributeValue)        
    }

    async whenQuit() { return this.client.quit() }
}