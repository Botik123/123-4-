const redis = require('redis');
const config = require('../config');

const client = redis.createClient({
  url: config.redisUrl
});

client.on('error', (err) => console.error('Redis error:', err));
client.on('connect', () => console.log('✅ Redis подключен'));

client.connect();

module.exports = client;