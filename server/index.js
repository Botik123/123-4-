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

// Хранилище активных WebSocket подключений
const clients = new Map();

// Rate limiting для сообщений
const messageCounts = new Map();
// Для предотвращения дублирования сообщений
const processedMessages = new Set();

// ============= REST API =============

// Регистрация с валидацией
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Проверка на пустые поля
  if (!username || !password) {
    return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
  }

  // Проверка длины
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Имя пользователя должно быть от 3 до 20 символов' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть минимум 4 символа' });
  }

  // Проверка на запрещённые символы
  if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Имя пользователя содержит недопустимые символы' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.run(
      'INSERT INTO users (id, username, password, online, last_seen) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hashedPassword, 0, Date.now()],
      (err) => {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Имя пользователя уже существует' });
          }
          return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.json({ id: userId, username, message: 'Регистрация успешна' });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Логин
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    db.run('UPDATE users SET online = 1, last_seen = ? WHERE id = ?', [Date.now(), user.id]);

    res.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar
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
      } catch (e) {}
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
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// Получить список пользователей
app.get('/users/:userId', (req, res) => {
  db.all(
    'SELECT id, username, online, last_seen FROM users WHERE id != ? ORDER BY online DESC',
    [req.params.userId],
    (err, users) => {
      if (err) {
        console.error('Error loading users:', err);
        return res.status(500).json({ error: 'Ошибка загрузки пользователей' });
      }
      res.json(users || []);
    }
  );
});

// Получить историю сообщений
app.get('/messages/:userId/:otherUserId', (req, res) => {
  db.all(
    `SELECT * FROM messages 
     WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
     ORDER BY timestamp ASC LIMIT 200`,
    [req.params.userId, req.params.otherUserId, req.params.otherUserId, req.params.userId],
    (err, messages) => {
      if (err) {
        console.error('Error loading messages:', err);
        return res.status(500).json({ error: 'Ошибка загрузки сообщений' });
      }
      res.json(messages || []);
    }
  );
});

// ============= WEBSOCKET =============

wss.on('connection', (ws) => {
  let currentUserId = null;

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data);

      switch (parsed.type) {
        case 'auth': {
          // Проверяем, что пользователь существует
          db.get('SELECT id FROM users WHERE id = ?', [parsed.userId], (err, user) => {
            if (err || !user) {
              ws.send(JSON.stringify({ type: 'error', message: 'Недействительный пользователь' }));
              ws.close();
              return;
            }

            currentUserId = parsed.userId;
            clients.set(currentUserId, ws);
            broadcastStatus(currentUserId, true);
            console.log(`✅ Пользователь ${currentUserId} авторизован (клиентов: ${clients.size})`);
          });
          break;
        }

        case 'message': {
          // Rate limiting
          const userKey = parsed.from;
          const now = Date.now();
          const userMessages = messageCounts.get(userKey) || [];
          const recentMessages = userMessages.filter(time => now - time < 5000);

          if (recentMessages.length > 5) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Слишком много сообщений! Подождите немного.'
            }));
            return;
          }

          recentMessages.push(now);
          messageCounts.set(userKey, recentMessages);

          // Очистка старых записей
          if (Math.random() < 0.01) {
            for (const [key, times] of messageCounts) {
              const validTimes = times.filter(time => now - time < 60000);
              if (validTimes.length === 0) {
                messageCounts.delete(key);
              } else {
                messageCounts.set(key, validTimes);
              }
            }
          }

          // Проверка на дублирование
          const messageId = parsed.id || uuidv4();
          if (processedMessages.has(messageId)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Сообщение уже отправлено' }));
            return;
          }
          processedMessages.add(messageId);

          // Очищаем старые ID
          if (processedMessages.size > 1000) {
            const toDelete = [...processedMessages].slice(0, 500);
            toDelete.forEach(id => processedMessages.delete(id));
          }

          const timestamp = Date.now();

          // Проверка на пустое сообщение
          if (!parsed.text || parsed.text.trim() === '') {
            ws.send(JSON.stringify({ type: 'error', message: 'Сообщение не может быть пустым' }));
            return;
          }

          db.run(
            `INSERT INTO messages (id, from_user, to_user, text, timestamp, read, reply_to, forwarded_from) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [messageId, parsed.from, parsed.to, parsed.text, timestamp, 0, parsed.reply_to || null, parsed.forwarded_from || null],
            (err) => {
              if (err) {
                console.error('Error saving message:', err);
                ws.send(JSON.stringify({ type: 'error', message: 'Ошибка сохранения сообщения' }));
                return;
              }

              const recipientWs = clients.get(parsed.to);
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                recipientWs.send(JSON.stringify({
                  type: 'message',
                  id: messageId,
                  from: parsed.from,
                  to: parsed.to,
                  text: parsed.text,
                  timestamp: timestamp,
                  read: 0,
                  reply_to: parsed.reply_to
                }));
              }

              ws.send(JSON.stringify({ type: 'message_sent', id: messageId, timestamp: timestamp }));
            }
          );
          break;
        }

        case 'edit_message': {
          if (!parsed.text || parsed.text.trim() === '') {
            ws.send(JSON.stringify({ type: 'error', message: 'Сообщение не может быть пустым' }));
            return;
          }

          db.run('UPDATE messages SET text = ?, edited = 1, edited_at = ? WHERE id = ?',
            [parsed.text, Date.now(), parsed.messageId],
            (err) => {
              if (err) {
                console.error('Error editing message:', err);
                ws.send(JSON.stringify({ type: 'error', message: 'Ошибка редактирования' }));
                return;
              }

              const editRecipient = clients.get(parsed.to);
              if (editRecipient && editRecipient.readyState === WebSocket.OPEN) {
                editRecipient.send(JSON.stringify({
                  type: 'message_edited',
                  messageId: parsed.messageId,
                  text: parsed.text,
                  edited_at: Date.now()
                }));
              }
            }
          );
          break;
        }

        case 'delete_message': {
          db.run('UPDATE messages SET text = "🗑️ Сообщение удалено", deleted = 1 WHERE id = ?', [parsed.messageId],
            (err) => {
              if (err) {
                console.error('Error deleting message:', err);
                ws.send(JSON.stringify({ type: 'error', message: 'Ошибка удаления' }));
                return;
              }

              const deleteRecipient = clients.get(parsed.to);
              if (deleteRecipient && deleteRecipient.readyState === WebSocket.OPEN) {
                deleteRecipient.send(JSON.stringify({
                  type: 'message_deleted',
                  messageId: parsed.messageId
                }));
              }
            }
          );
          break;
        }

        case 'reaction': {
          const reactionId = uuidv4();
          db.run(
            `INSERT OR REPLACE INTO message_reactions (id, message_id, user_id, reaction, timestamp) 
             VALUES (?, ?, ?, ?, ?)`,
            [reactionId, parsed.messageId, parsed.userId, parsed.reaction, Date.now()],
            (err) => {
              if (err) {
                console.error('Error adding reaction:', err);
                ws.send(JSON.stringify({ type: 'error', message: 'Ошибка добавления реакции' }));
                return;
              }

              const reactionRecipient = clients.get(parsed.to);
              if (reactionRecipient && reactionRecipient.readyState === WebSocket.OPEN) {
                reactionRecipient.send(JSON.stringify({
                  type: 'reaction',
                  messageId: parsed.messageId,
                  userId: parsed.userId,
                  reaction: parsed.reaction
                }));
              }
            }
          );
          break;
        }

        case 'read': {
          db.run('UPDATE messages SET read = 1 WHERE from_user = ? AND to_user = ?', [parsed.from, parsed.to],
            (err) => {
              if (err) {
                console.error('Error marking as read:', err);
                return;
              }

              const senderWs = clients.get(parsed.from);
              if (senderWs && senderWs.readyState === WebSocket.OPEN) {
                senderWs.send(JSON.stringify({ type: 'message_read', from: parsed.to, to: parsed.from }));
              }
            }
          );
          break;
        }

        case 'typing': {
          const targetWs = clients.get(parsed.to);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({ type: 'typing', from: parsed.from }));
          }
          break;
        }

        default: {
          console.log('Неизвестный тип сообщения:', parsed.type);
        }
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Ошибка обработки запроса' }));
    }
  });

  ws.on('close', () => {
    if (currentUserId) {
      clients.delete(currentUserId);
      db.run('UPDATE users SET online = 0, last_seen = ? WHERE id = ?', [Date.now(), currentUserId]);
      broadcastStatus(currentUserId, false);
      console.log(`🔌 Пользователь ${currentUserId} отключился (клиентов: ${clients.size})`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Ping/Pong для обнаружения мёртвых соединений
const pingInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 30000);

// Очищаем интервал при закрытии сервера
wss.on('close', () => {
  clearInterval(pingInterval);
});

function broadcastStatus(userId, isOnline) {
  const statusMessage = JSON.stringify({
    type: 'status',
    userId: userId,
    online: isOnline,
    last_seen: Date.now()
  });

  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(statusMessage);
      sentCount++;
    }
  });

  console.log(`📡 Статус пользователя ${userId} (${isOnline ? 'онлайн' : 'оффлайн'}) отправлен ${sentCount} клиентам`);
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 WebSocket на ws://localhost:${PORT}`);
});