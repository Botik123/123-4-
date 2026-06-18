const http = require('http');
const app = require('./app');
const { setupWebSocket } = require('./socket');
const config = require('./config');

// Подключаем Redis
require('./redis');

const server = http.createServer(app);

// Настраиваем WebSocket
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║     🚀 МЕССЕНДЖЕР СЕРВЕР v2.0 🚀               ║
╠══════════════════════════════════════════════════╣
║  HTTP:    http://localhost:${config.port}        ║
║  WebSocket: ws://localhost:${config.port}        ║
║  Redis:   ${config.redisUrl}                     ║
╚══════════════════════════════════════════════════╝
  `);
});