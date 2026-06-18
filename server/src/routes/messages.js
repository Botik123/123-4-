const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const { sendMessageToUser, notifyMessageUpdate, broadcastReaction } = require('../socket');

const router = express.Router();

// Все роуты требуют авторизации
router.use(authMiddleware);

// Получить историю сообщений
router.get('/:userId/:otherUserId', async (req, res) => {
  try {
    const messages = await db.getMessagesBetweenUsers(
      req.params.userId,
      req.params.otherUserId
    );
    res.json(messages);
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// Отправить сообщение
router.post('/', sanitizeBody, async (req, res) => {
  const { to, text, reply_to } = req.body;

  if (!to || !text || text.trim() === '') {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  try {
    const messageId = uuidv4();
    const timestamp = Date.now();

    const message = await db.createMessage(
      messageId,
      req.userId,
      to,
      text.trim(),
      timestamp,
      reply_to || null,
      null
    );

    // Отправляем сообщение получателю через WebSocket
    const delivered = sendMessageToUser(req.userId, to, {
      id: messageId,
      from: req.userId,
      to: to,
      text: text.trim(),
      timestamp: timestamp,
      read: 0,
      reply_to: reply_to || null
    });

    res.json({
      ...message,
      delivered
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

// Редактировать сообщение
router.put('/:messageId', sanitizeBody, async (req, res) => {
  const { text, to } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  try {
    const result = await db.editMessage(req.params.messageId, text.trim());

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    // Уведомляем получателя
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

  if (!to) {
    return res.status(400).json({ error: 'Не указан получатель' });
  }

  try {
    const result = await db.deleteMessage(req.params.messageId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    // Уведомляем получателя
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

  if (!to || !messageId) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  try {
    // Получаем оригинальное сообщение
    // TODO: Добавить запрос на получение сообщения по ID

    // Создаём пересланное сообщение
    // TODO: Реализовать

    res.json({ success: true });

  } catch (error) {
    console.error('Error forwarding message:', error);
    res.status(500).json({ error: 'Ошибка пересылки' });
  }
});

// Поставить реакцию
router.post('/reaction', async (req, res) => {
  const { messageId, reaction, to } = req.body;

  if (!messageId || !reaction || !to) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  try {
    const id = uuidv4();
    await db.addReaction(id, messageId, req.userId, reaction);

    // Уведомляем получателя
    broadcastReaction(messageId, req.userId, reaction, to);

    res.json({ success: true });

  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Ошибка добавления реакции' });
  }
});

// Отметить как прочитанное
router.post('/read', async (req, res) => {
  const { from } = req.body;

  if (!from) {
    return res.status(400).json({ error: 'Не указан отправитель' });
  }

  try {
    await db.markMessagesAsRead(from, req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Ошибка' });
  }
});

module.exports = router;