/**
 * @file server/src/index.js
 * @description Точка входа сервера мессенджера
 * Инициализирует HTTP-сервер, WebSocket и обработку graceful shutdown
 */

const http = require('http');
const express = require('express');
const app = require('./app');
const { setupWebSocket } = require('./socket');
const config = require('./config');

// Создаём HTTP-сервер на базе Express
const server = http.createServer(app);

// Обработка ошибок сервера (например, порт занят)
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${config.port} уже используется!`);
    process.exit(1);
  } else {
    console.error('❌ Ошибка сервера:', error);
  }
});

// Инициализация WebSocket сервера
const wss = setupWebSocket(server);

/**
 * Graceful shutdown - корректное завершение работы
 * Закрывает все WebSocket соединения перед остановкой сервера
 */
process.on('SIGINT', () => {
  console.log('\n🛑 Завершение работы...');
  if (wss && wss.clients) {
    wss.clients.forEach((ws) => {
      ws.close(1000, 'Server shutting down');
    });
  }
  if (wss) {
    wss.close(() => {
      server.close(() => {
        console.log('✅ Сервер остановлен');
        process.exit(0);
      });
    });
  } else {
    server.close(() => {
      console.log('✅ Сервер остановлен');
      process.exit(0);
    });
  }
});

// Запуск сервера на порту из конфига
server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║     🚀 МЕССЕНДЖЕР СЕРВЕР v2.0 🚀               ║
╠══════════════════════════════════════════════════╣
║  HTTP:    http://localhost:${config.port}        ║
║  WebSocket: ws://localhost:${config.port}        ║
╚══════════════════════════════════════════════════╝
  `);
});