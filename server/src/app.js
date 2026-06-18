const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Обработка кривого JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('❌ Кривой JSON:', err.message);
    return res.status(400).json({ error: 'Неверный формат JSON' });
  }
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);
app.use('/upload', uploadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('❌ Глобальная ошибка:', err.stack);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Файл слишком большой (макс. 50MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  const status = err.status || 500;
  const message = err.isOperational ? err.message : 'Внутренняя ошибка сервера';
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;