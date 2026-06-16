const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Создаем папку для загрузок
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Хранилище активных WebSocket подключений: userId -> Set(WebSocket)
const clients = new Map();

// ============= REST API =============

// Регистрация
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    db.run(
      'INSERT INTO users (id, username, password, online, last_seen) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hashedPassword, 0, Date.now()],
      (err) => {
        if (err) {
          return res.status(400).json({ error: 'Имя пользователя уже существует' });
        }
        res.json({ id: userId, username });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Логин
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
    
    // Сначала сохраняем статус в бд, затем отдаем ответ клиенту
    db.run('UPDATE users SET online = 1, last_seen = ? WHERE id = ?', [Date.now(), user.id], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ error: 'Ошибка обновления статуса авторизации' });
      }
      res.json({
        id: user.id,
        username: user.username,
        avatar: user.avatar
      });
    });
  });
});

// Загрузка файла
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    let fileUrl = `/uploads/${file.filename}`;
    let fileType = 'file';
    let thumbnail = null;

    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
      try {
        const thumbnailPath = path.join(uploadDir, `thumb_${file.filename}`);
        await sharp(file.path).resize(200, 200, { fit: 'inside' }).toFile(thumbnailPath);
        thumbnail = `/uploads/thumb_${file.filename}`;
      } catch (e) {
        console.error('Ошибка создания миниатюры:', e);
      }
    } else if (file.mimetype.startsWith('video/')) {
      fileType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      fileType = 'audio';
    }

    res.json({
      url: fileUrl,
      thumbnail: thumbnail,
      type: fileType,
      name: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// Получить список пользователей
app.get('/users/:userId', (req, res) => {
  db.all(
    'SELECT id, username, online, last_seen FROM users WHERE id != ? ORDER BY online DESC',
    [req.params.userId],
    (err, users) => {
      if (err) return res.status(500).json({ error: 'Ошибка получения пользователей' });
      res.json(users || []);
    }
  );
});

// Получить историю сообщений (ИСПРАВЛЕНО: берет последние 200 сообщений)
app.get('/messages/:userId/:otherUserId', (req, res) => {
  db.all(
    `SELECT * FROM (
      SELECT * FROM messages 
      WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
      ORDER BY timestamp DESC LIMIT 200
    ) ORDER BY timestamp ASC`,
    [req.params.userId, req.params.otherUserId, req.params.otherUserId, req.params.userId],
    (err, messages) => {
      if (err) return res.status(500).json({ error: 'Ошибка загрузки истории сообщений' });
      res.json(messages || []);
    }
  );
});

// ============= WEBSOCKET =============

// Вспомогательная функция отправки сообщения пользователю на все его открытые вкладки
function sendToUser(userId, payload) {
  const userSockets = clients.get(userId);
  if (userSockets) {
    const messageStr = JSON.stringify(payload);
    userSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
}

wss.on('connection', (ws) => {
  let currentUserId = null;
  
  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data);
      
      switch (parsed.type) {
        case 'auth':
          currentUserId = parsed.userId;
          if (!clients.has(currentUserId)) {
            clients.set(currentUserId, new Set());
          }
          clients.get(currentUserId).add(ws);
          broadcastStatus(currentUserId, true);
          break;
          
        case 'message':
          const messageId = uuidv4();
          const timestamp = Date.now();
          
          db.run(
            `INSERT INTO messages (id, from_user, to_user, text, timestamp, read, reply_to, forwarded_from) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [messageId, parsed.from, parsed.to, parsed.text, timestamp, 0, parsed.reply_to || null, parsed.forwarded_from || null],
            (err) => {
              if (err) {
                return ws.send(JSON.stringify({ type: 'error', message: 'Ошибка сохранения сообщения в БД' }));
              }

              const messagePayload = {
                type: 'message',
                id: messageId,
                from: parsed.from,
                to: parsed.to,
                text: parsed.text,
                timestamp: timestamp,
                read: 0,
                reply_to: parsed.reply_to
              };

              // Отправляем получателю (на все вкладки) и дублируем себе (на случай других наших вкладок)
              sendToUser(parsed.to, messagePayload);
              sendToUser(parsed.from, messagePayload); 
              
              // Подтверждаем текущей вкладке успешную отправку
              ws.send(JSON.stringify({ type: 'message_sent', id: messageId, timestamp: timestamp }));
            }
          );
          break;
          
        case 'edit_message':
          const editTimestamp = Date.now();
          db.run(
            'UPDATE messages SET text = ?, edited = 1, edited_at = ? WHERE id = ?',
            [parsed.text, editTimestamp, parsed.messageId],
            (err) => {
              if (!err) {
                const editPayload = {
                  type: 'message_edited',
                  messageId: parsed.messageId,
                  text: parsed.text,
                  edited_at: editTimestamp
                };
                sendToUser(parsed.to, editPayload);
                sendToUser(currentUserId, editPayload);
              }
            }
          );
          break;
          
        case 'delete_message':
          db.run(
            'UPDATE messages SET text = "🗑️ Сообщение удалено", deleted = 1 WHERE id = ?',
            [parsed.messageId],
            (err) => {
              if (!err) {
                const deletePayload = {
                  type: 'message_deleted',
                  messageId: parsed.messageId
                };
                sendToUser(parsed.to, deletePayload);
                sendToUser(currentUserId, deletePayload);
              }
            }
          );
          break;
          
        case 'reaction':
          const reactionId = uuidv4();
          const reactionTimestamp = Date.now();
          db.run(
            `INSERT OR REPLACE INTO message_reactions (id, message_id, user_id, reaction, timestamp) 
             VALUES (?, ?, ?, ?, ?)`,
            [reactionId, parsed.messageId, parsed.userId, parsed.reaction, reactionTimestamp],
            (err) => {
              if (!err) {
                const reactionPayload = {
                  type: 'reaction',
                  messageId: parsed.messageId,
                  userId: parsed.userId,
                  reaction: parsed.reaction
                };
                sendToUser(parsed.to, reactionPayload);
                sendToUser(currentUserId, reactionPayload);
              }
            }
          );
          break;
          
        case 'read':
          db.run(
            'UPDATE messages SET read = 1 WHERE from_user = ? AND to_user = ?',
            [parsed.from, parsed.to],
            (err) => {
              if (!err) {
                sendToUser(parsed.from, { type: 'message_read', from: parsed.to, to: parsed.from });
              }
            }
          );
          break;
          
        case 'typing':
          sendToUser(parsed.to, { type: 'typing', from: parsed.from });
          break;
      }
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });
  
  ws.on('close', () => {
    if (currentUserId && clients.has(currentUserId)) {
      const userSockets = clients.get(currentUserId);
      userSockets.delete(ws); // Удаляем закрывшуюся вкладку
      
      // Если это была последняя открытая вкладка пользователя
      if (userSockets.size === 0) {
        clients.delete(currentUserId);
        db.run('UPDATE users SET online = 0, last_seen = ? WHERE id = ?', [Date.now(), currentUserId], (err) => {
          broadcastStatus(currentUserId, false);
        });
      }
    }
  });
});

function broadcastStatus(userId, isOnline) {
  const statusMessage = JSON.stringify({
    type: 'status',
    userId: userId,
    online: isOnline,
    last_seen: Date.now()
  });
  
  clients.forEach((userSockets) => {
    userSockets.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(statusMessage);
      }
    });
  });
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});