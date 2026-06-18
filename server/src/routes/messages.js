const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const { sendMessageToUser, sendMessageToRoom, notifyMessageUpdate, broadcastReaction } = require('../socket');

const router = express.Router();

router.use(authMiddleware);

// Получить историю сообщений
router.get('/:userId/:otherUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.otherUserId;
    
    if (userId !== req.params.userId) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const messages = await db.getMessagesBetweenUsers(userId, otherUserId);
    res.json(messages);
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// Отправить сообщение
router.post('/', sanitizeBody, async (req, res) => {
  const { to, text, reply_to, chatId } = req.body;
  const from = req.user.id;

  if (!to) {
    return res.status(400).json({ error: 'Не указан получатель' });
  }

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
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
      null
    );

    const messageData = {
      id: messageId,
      from: from,
      to: to,
      text: text.trim(),
      timestamp: timestamp,
      read: 0,
      reply_to: reply_to || null
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

// Удалить сообщение
router.delete('/:messageId', async (req, res) => {
  const { to } = req.body;
  const userId = req.user.id;

  if (!to) {
    return res.status(400).json({ error: 'Не указан получатель' });
  }

  try {
    const message = await db.getMessageById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    if (message.from_user !== userId) {
      return res.status(403).json({ error: 'Нельзя удалять чужое сообщение' });
    }

    const result = await db.deleteMessage(req.params.messageId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    notifyMessageUpdate(to, 'message_deleted', {
      messageId: req.params.messageId
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// Переслать сообщение
router.post('/forward', sanitizeBody, async (req, res) => {
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
      originalMessage.from_user
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
router.post('/reaction', async (req, res) => {
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
router.post('/read', async (req, res) => {
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

module.exports = router;