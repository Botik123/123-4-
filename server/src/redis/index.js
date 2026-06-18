const redis = require('redis');
const config = require('../config');

let client = null;

// 🔥 ФИКС: Обработка ошибок подключения
try {
  client = redis.createClient({
    url: config.redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('❌ Redis: превышено число попыток переподключения');
          return new Error('Redis connection failed');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  client.on('error', (err) => {
    console.error('❌ Redis ошибка:', err.message);
  });

  client.on('connect', () => {
    console.log('✅ Redis подключен');
  });

  client.on('reconnecting', () => {
    console.log('🔄 Redis переподключение...');
  });

  client.connect().catch((err) => {
    console.error('❌ Redis не удалось подключиться:', err.message);
    client = null;
  });

} catch (error) {
  console.error('❌ Redis инициализация не удалась:', error.message);
  client = null;
}

// 🔥 ФИКС: Безопасные обёртки для методов
const safeRedis = {
  get: async (key) => {
    if (!client) return null;
    try {
      return await client.get(key);
    } catch (error) {
      console.error('Redis GET error:', error.message);
      return null;
    }
  },
  set: async (key, value, options) => {
    if (!client) return null;
    try {
      return await client.set(key, value, options);
    } catch (error) {
      console.error('Redis SET error:', error.message);
      return null;
    }
  },
  del: async (key) => {
    if (!client) return null;
    try {
      return await client.del(key);
    } catch (error) {
      console.error('Redis DEL error:', error.message);
      return null;
    }
  },
  isConnected: () => !!client && client.isOpen
};

module.exports = safeRedis;