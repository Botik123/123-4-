const http = require('http');
const app = require('./app');
const { setupWebSocket } = require('./socket');
const config = require('./config');

const server = http.createServer(app);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${config.port} уже используется!`);
    process.exit(1);
  } else {
    console.error('❌ Ошибка сервера:', error);
  }
});

const wss = setupWebSocket(server);

process.on('SIGINT', () => {
  console.log('\n🛑 Завершение работы...');
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutting down');
  });
  wss.close(() => {
    server.close(() => {
      console.log('✅ Сервер остановлен');
      process.exit(0);
    });
  });
});

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