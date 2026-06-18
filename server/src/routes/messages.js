const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const { sendMessageToUser, sendMessageToRoom, notifyMessageUpdate, broadcastReaction } = require('../socket');
const redis = require('../redis');

const router = express.Router();

router.use(authMiddleware);

// ============ ПРОВЕРКА ДУБЛИКАТОВ ============

const isMessageDuplicate = async (clientId) => {
  if (!clientId) return false;
  
  try {
    const exists = await redis.get(`msg:${clientId}`);
    return exists !== null;
  } catch (error) {
    console.error('Redis duplicate check error:', error);
    return false;
  }
};

const markMessageAsProcessed = async (clientId) => {
  if (!clientId) return;
  
  try {
    await redis.set(`msg:${clientId}`, '1', { EX: 5 });
  } catch (error) {
    console.error('Redis mark error:', error);
  }
};

// ============ РОУТЫ ============

// Получить историю сообщений
router.get('/:userId/:otherUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.otherUserId;
    
    console.log(`📥 Запрос истории: userId=${userId}, otherUserId=${otherUserId}`);
    
    // Получаем сообщения между текущим пользователем и собеседником
    const messages = await db.getMessagesBetweenUsers(userId, otherUserId);
    res.json(messages);
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// Отправить сообщение
router.post('/', sanitizeBody, async (req, res) => {
  const { to, text, reply_to, chatId, clientId } = req.body;
  const from = req.user.id;

  if (!to) {
    return res.status(400).json({ error: 'Не указан получатель' });
  }

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  // Проверка дубликата
  if (clientId) {
    const isDuplicate = await isMessageDuplicate(clientId);
    if (isDuplicate) {
      console.log(`⚠️ Дубликат сообщения ${clientId} отклонён`);
      return res.status(409).json({ 
        error: 'Duplicate message', 
        clientId,
        alreadyProcessed: true 
      });
    }
  }

  try {
    const messageId = uuidv4();
    const timestamp = Date.now();

    await db.createMessage(
      messageId,
      from,
      to,
      text.trim(),
      timestamp,
      reply_to || null,
      null,
      clientId || null
    );

    if (clientId) {
      await markMessageAsProcessed(clientId);
    }

    const messageData = {
      id: messageId,
      from: from,
      to: to,
      text: text.trim(),
      timestamp: timestamp,
      read: 0,
      reply_to: reply_to || null,
      clientId: clientId || null
    };

    let delivered = false;
    if (chatId) {
      delivered = sendMessageToRoom(chatId, messageData);
    } else {
      delivered = sendMessageToUser(to, messageData);
    }

    res.json({
      id: messageId,
      ...messageData,
      delivered
    });

  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error);
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

// Редактировать сообщение
router.put('/:messageId', sanitizeBody, async (req, res) => {
  const { text, to } = req.body;
  const userId = req.user.id;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  if (!to) {
    return res.status(400).json({ error: 'Не указан получатель' });
  }

  try {
    const message = await db.getMessageById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    if (message.from_user !== userId) {
      return res.status(403).json({ error: 'Нельзя редактировать чужое сообщение' });
    }

    const result = await db.editMessage(req.params.messageId, text.trim());

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    notifyMessageUpdate(to, 'message_edited', {
      messageId: req.params.messageId,
      text: text.trim(),
      edited_at: Date.now()
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Ошибка редактирования' });
  }
});

// Удалить сообщение (с удалением файла)
router.delete('/:messageId', authMiddleware, async (req, res) => {
  const { to } = req.body;
  const userId = req.user.id;

  if (!to) {
    return res.status(400).json({ error: 'Не указан получатель' });
  }

  try {
    // Получаем сообщение перед удалением
    const message = await db.getMessageById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    if (message.from_user !== userId) {
      return res.status(403).json({ error: 'Нельзя удалять чужое сообщение' });
    }

    // Удаляем файл, если он есть
    let fileDeleted = false;
    if (message.file_path) {
      const filePath = path.join(__dirname, '../../', message.file_path);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Файл удалён: ${filePath}`);
          fileDeleted = true;
          
          // Удаляем миниатюру если есть
          const thumbPath = filePath.replace(/(\.[^.]+)$/, '_thumb$1');
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
            console.log(`🗑️ Миниатюра удалена: ${thumbPath}`);
          }
        }
      } catch (fileError) {
        console.error('❌ Ошибка удаления файла:', fileError);
      }
    }

    // Удаляем сообщение из БД
    const result = await db.deleteMessage(req.params.messageId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    notifyMessageUpdate(to, 'message_deleted', {
      messageId: req.params.messageId
    });

    res.json({ success: true, fileDeleted });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// Переслать сообщение
router.post('/forward', authMiddleware, sanitizeBody, async (req, res) => {
  const { to, messageId } = req.body;
  const userId = req.user.id;

  if (!to || !messageId) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  try {
    const originalMessage = await db.getMessageById(messageId);
    
    if (!originalMessage) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const newMessageId = uuidv4();
    const timestamp = Date.now();
    
    const forwardedText = `📎 Переслано: ${originalMessage.text}`;

    await db.createMessage(
      newMessageId,
      userId,
      to,
      forwardedText,
      timestamp,
      null,
      originalMessage.from_user,
      null
    );

    const delivered = sendMessageToUser(to, {
      id: newMessageId,
      from: userId,
      to: to,
      text: forwardedText,
      timestamp: timestamp,
      read: 0,
      forwarded_from: originalMessage.from_user
    });

    res.json({ 
      id: newMessageId, 
      delivered,
      forwarded_from: originalMessage.from_user
    });

  } catch (error) {
    console.error('Error forwarding message:', error);
    res.status(500).json({ error: 'Ошибка пересылки' });
  }
});

// Поставить реакцию
router.post('/reaction', authMiddleware, async (req, res) => {
  const { messageId, reaction, to } = req.body;
  const userId = req.user.id;

  if (!messageId || !reaction || !to) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  try {
    const id = uuidv4();
    await db.addReaction(id, messageId, userId, reaction);

    broadcastReaction(messageId, userId, reaction, to);

    res.json({ success: true });

  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Ошибка добавления реакции' });
  }
});

// Отметить как прочитанное
router.post('/read', authMiddleware, async (req, res) => {
  const { from } = req.body;
  const userId = req.user.id;

  if (!from) {
    return res.status(400).json({ error: 'Не указан отправитель' });
  }

  try {
    await db.markMessagesAsRead(from, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// Очистка осиротевших файлов (админский роут)
router.post('/cleanup-orphan-files', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  
  // TODO: Добавить проверку isAdmin
  // if (!isAdmin) return res.status(403).json({ error: 'Доступ запрещён' });
  
  try {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      return res.json({ success: true, deletedCount: 0, message: 'Папка uploads не найдена' });
    }
    
    const files = fs.readdirSync(uploadDir);
    
    // Получаем все файлы из БД
    const dbFiles = await db.getAllFilePaths();
    const dbFileSet = new Set(dbFiles.map(f => path.basename(f.file_path)));
    
    let deletedCount = 0;
    for (const file of files) {
      // Пропускаем миниатюры (они удаляются вместе с основным файлом)
      if (file.startsWith('thumb_')) {
        const originalFile = file.replace('thumb_', '');
        if (!dbFileSet.has(originalFile)) {
          fs.unlinkSync(path.join(uploadDir, file));
          deletedCount++;
        }
        continue;
      }
      
      if (!dbFileSet.has(file)) {
        fs.unlinkSync(path.join(uploadDir, file));
        deletedCount++;
      }
    }
    
    res.json({ 
      success: true, 
      deletedCount,
      message: `Удалено ${deletedCount} осиротевших файлов`
    });
    
  } catch (error) {
    console.error('Ошибка очистки файлов:', error);
    res.status(500).json({ error: 'Ошибка очистки файлов' });
  }
});

module.exports = router;