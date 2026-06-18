/**
 * @file server/src/app.js
 * @description Основное Express-приложение
 * Настраивает middleware, маршруты и глобальные обработчики ошибок
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');

const app = express();

// === MIDDLEWARE ===

// Разрешаем CORS для всех origin (в продакшене ограничить!)
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Логирование всех запросов для отладки
app.use((req, res, next) => {
  console.log(`📋 ${req.method} ${req.path}`);
  next();
});

// Парсинг JSON с увеличенным лимитом для файловых сообщений
app.use(express.json({ limit: '50mb' }));

/**
 * Обработчик невалидного JSON
 * Должен идти ПОСЛЕ express.json() для перехвата ошибок парсинга
 */
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('❌ Кривой JSON:', err.message);
    return res.status(400).json({ error: 'Неверный формат JSON' });
  }
  next();
});

// Статические файлы для загруженных изображений/файлов
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// === МАРШРУТЫ ===
app.use('/auth', authRoutes);      // Регистрация, логин
app.use('/users', userRoutes);     // Список пользователей
app.use('/messages', messageRoutes); // Сообщения, реакции
app.use('/upload', uploadRoutes);  // Загрузка файлов

// Health check для мониторинга
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Глобальный обработчик ошибок
 * Перехватывает все необработанные ошибки приложения
 */
app.use((err, req, res, next) => {
  console.error('❌ Глобальная ошибка:', err.stack);
  
  // Обработка ошибок Multer (загрузка файлов)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Файл слишком большой (макс. 50MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  // Безопасный ответ: не показываем детали ошибок в продакшене
  const status = err.status || 500;
  const message = err.isOperational ? err.message : 'Внутренняя ошибка сервера';
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;