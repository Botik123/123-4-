const memoryStore = new Map();

const client = {
  set: async (key, value, options) => {
    memoryStore.set(key, value);
    return true;
  },
  get: async (key) => {
    return memoryStore.get(key) || null;
  },
  del: async (key) => {
    memoryStore.delete(key);
    return true;
  },
  on: (event, callback) => {
    if (event === 'connect') {
      setTimeout(callback, 100);
    }
    if (event === 'error') {}
  },
  connect: async () => {
    console.log('✅ In-memory storage готов');
    console.log('⚠️ Для production установите Redis');
    return true;
  }
};

// Имитируем подключение
setTimeout(() => {
  console.log('✅ In-memory storage активен');
}, 200);

module.exports = client;