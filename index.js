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
        this.client = options.client || redis.createClient(options.port || 6379, options.host || 'localhost')
        _.bindAll(this, 'buildKey', 'whenFlush', 'whenGetAttributeValues', 'whenGet', 'whenStore', 'whenQuit')        
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

    whenStore(poco) {
        if (!_.isObjectLike(poco) || _.isArray(poco)) return Promise.reject(new Error('Invalid object'))

        const id = poco[this.idAttribute]
        if (!id) return Promise.reject(new Error(this.idAttribute + ' missing on ' + JSON.stringify(poco)))
       
        const invalidAttributes = _.reject(this.attributes, attribute => this.isAttributeValueValid(poco[attribute]))

        if (invalidAttributes.length > 0)
            return Promise.reject(new Error(_.join(invalidAttributes) + ' of ' + JSON.stringify(poco) + ' are not string/number or array of strings'))

        return this.whenGet(id)
            .then(oldPoco => {
                const transaction = this.client.multi() 
                transaction.hset(this.buildKey(this.itemKey), poco[this.idAttribute], JSON.stringify(poco))
                for (const attribute of this.attributes)
                {
                    if (_.isNil(poco[attribute])) {
                        if (!_.isNil(oldPoco) && !_.isNil(oldPoco[attribute]))
                            _.forEach(this.toArray(oldPoco[attribute]), value => {
                                if (!_.isNil(value)) {
                                    if (_.isNumber(value))
                                        transaction.zrem(this.buildKey(attribute), value, id)
                                    else
                                        transaction.srem(this.buildKey(attribute, value), id)
                                }
                            })
                    } else
                        _.forEach(this.toArray(poco[attribute]), value => {
                            if (!_.isNil(value)) {
                                if (_.isNumber(value))
                                    transaction.zadd(this.buildKey(attribute), value, id)
                                else
                                    transaction.sadd(this.buildKey(attribute, value), id)
                            }
                        })              
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