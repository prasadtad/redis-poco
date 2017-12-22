// index.js

const _ = require('lodash')

require('util.promisify/shim')()
const redis = require('redis-promisify')

module.exports = class RedisPoco {
    constructor(options) {
        options = options || {}
        this.idAttribute = options.idAttribute || 'id'
        this.itemKey = options.itemKey || 'Item'
        this.attributes = options.attributes
        this.namespace = options.namespace || 'Poco'       
        this.operatingSetsExpireSeconds = options.operatingSetsExpireSeconds || 60
        this.client = options.client || (options.endpoint ? redis.createClient(options.endpoint) : redis.createClient(options.port || 6379, options.host || 'localhost'))
        _.bindAll(this, 'buildKey', 'whenFlush', 'whenGetAttributeValues', 'whenGet', 'whenFilter', 'whenSetOr', 'whenSetsAnd', 'whenRemove', 'whenStore', 'whenQuit')        
    }

    buildKey(...suffix) {
        return this.namespace + ':' + suffix.join(':')
    }

    whenFlush() { return this.client.flushdbAsync() }

    whenGetAttributeValues(attribute) {
        attribute = this.buildKey(attribute) + ':'
        return this.client.keysAsync(attribute + '*')
                .then(keys => _.map(keys, k => k.substring(attribute.length)))
    }

    whenGet(id) {
        return this.client.hgetAsync(this.buildKey(this.itemKey), id)
            .then(poco => Promise.resolve(JSON.parse(poco)))
    }

    whenFilter(filter) {
        if (!_.isObjectLike(filter) || _.isArray(filter)) return Promise.reject(new Error('Invalid filter'))

        const validAttributes = _.reject(this.attributes, attribute => _.isNil(filter[attribute]))
        const numericAttributes = _.filter(validAttributes, attribute => _.isObject(filter[attribute]) && !_.isArray(filter[attribute]))

        const whenRangeByScores = _.map(numericAttributes, attribute => this.client.zrangebyscoreAsync(this.buildKey(attribute), filter[attribute].min ? filter[attribute].min : '-inf', filter[attribute].max ? filter[attribute].max : '+inf', 'WITHSCORES'))
        
        return Promise.all(whenRangeByScores)
            .then(allIdsAndscores => {
                const keyPromises = []
                let keys = []
                for (var i=0; i<numericAttributes.length; i++)
                {
                    if (!allIdsAndscores[i] || allIdsAndscores[i].length == 0) continue
                    const scores = _.uniq(_.map(_.chunk(allIdsAndscores[i], 2), idAndScore => idAndScore[1]))
                    if (scores.length == 1)
                        keys.push(this.buildKey(numericAttributes[i], scores[0]))
                    else
                        keyPromises.push(this.whenSetOr(this.buildKey(numericAttributes[i]), scores))
                }
                return Promise.all(keyPromises)
                    .then(k => {
                        keys.push(_.difference(validAttributes, numericAttributes)
                                        .map(attribute => _.map(this.toArray(filter[attribute]), 
                                                            v => this.buildKey(attribute, v))))
                        keys = _.flattenDeep(keys)
                        return this.whenSetsAnd(_.union(k, keys))
                                    .then(set => 
                                        this.client.smembersAsync(set)
                                    )
                    })
            })
    }

    whenSetOr(setPrefix, setNames) {
        const setKeys = _.map(setNames, setName => this.buildKey(setPrefix, setName))
        const destination = setKeys.join('|')
        return this.client.sunionstoreAsync(destination, setKeys)
            .then(() => this.client.expireAsync(destination, this.operatingSetsExpireSeconds))
            .then(() => destination)
    }

    whenSetsAnd(setKeys) {
        const destination = setKeys.join('&')
        return this.client.sinterstoreAsync(destination, setKeys)
            .then(() => this.client.expireAsync(destination, this.operatingSetsExpireSeconds))
            .then(() => destination)
    }

    whenRemove(id) {
        return this.whenStore({id: id}).then(() => this.client.hdelAsync(this.buildKey(this.itemKey), id))
    }

    whenStore(poco) {
        if (!_.isObjectLike(poco) || _.isArray(poco)) return Promise.reject(new Error('Invalid object'))

        const id = poco[this.idAttribute]
        if (!id) return Promise.reject(new Error(this.idAttribute + ' missing on ' + JSON.stringify(poco)))
       
        const invalidAttributes = _.reject(this.attributes, attribute => this.isAttributeValueValid(poco[attribute]))

        if (invalidAttributes.length > 0)
            return Promise.reject(new Error(_.join(invalidAttributes) + ' of ' + JSON.stringify(poco) + ' are not string/number/bool or array of strings'))

        return this.whenGet(id)
            .then(oldPoco => {
                const transaction = this.client.multi() 
                transaction.hset(this.buildKey(this.itemKey), poco[this.idAttribute], JSON.stringify(poco))
                for (const attribute of this.attributes)
                {
                    if (!_.isNil(oldPoco) && !_.isNil(oldPoco[attribute])) {
                        _.forEach(this.toArray(oldPoco[attribute]), value => {
                            if (!_.isNil(value)) {
                                transaction.srem(this.buildKey(attribute, value), id)
                                transaction.zrem(this.buildKey(attribute), value, id)                                    
                            }
                        })
                    }

                    if (!_.isNil(poco[attribute])) {                        
                        _.forEach(this.toArray(poco[attribute]), value => {
                            if (!_.isNil(value)) {
                                transaction.sadd(this.buildKey(attribute, value), id)
                                if (_.isNumber(value))
                                    transaction.zadd(this.buildKey(attribute), value, id)                                   
                            }
                        })              
                    }
                }
                return transaction.execAsync() 
            })        
    }

    toArray(values) {
        if (!_.isArray(values)) values = [ values ]
        return values
    }
    
    isAttributeValueValid(attributeValue) {
        if (_.isArray(attributeValue)) return !_.some(attributeValue, v => _.isObject(v) || _.isNumber(v))
        return !_.isObject(attributeValue)        
    }

    whenQuit() { return this.client.quitAsync() }    
}