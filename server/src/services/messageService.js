/**
 * @file server/src/services/messageService.js
 * @description Сервис сообщений - бизнес-логика
 * Отделяет HTTP обработчики от WebSocket и БД
 */

const db = require('../db/queries');
const { sendMessageToUser, sendMessageToRoom, notifyMessageUpdate, broadcastReaction } = require('../socket');
const redis = require('../redis');

/**
 * Проверка дубликата сообщения по clientId
 */
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

/**
 * Пометить сообщение как обработанное
 */
const markMessageAsProcessed = async (clientId) => {
  if (!clientId) return;
  
  try {
    await redis.set(`msg:${clientId}`, '1', { EX: 5 });
  } catch (error) {
    console.error('Redis mark error:', error);
  }
};

/**
 * Создать и отправить сообщение
 */
const createAndSend = async (from, to, text, reply_to = null, chatId = null, clientId = null) => {
  // Проверка дубликата
  if (clientId) {
    const isDuplicate = await isMessageDuplicate(clientId);
    if (isDuplicate) {
      console.log(`⚠️ Дубликат сообщения ${clientId} отклонён`);
      return { error: 'Duplicate message', alreadyProcessed: true };
    }
  }

  const { v4: uuidv4 } = require('uuid');
  const messageId = uuidv4();
  const timestamp = Date.now();

  // Создаём в БД
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

  // Помечаем как обработанное
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

  // Отправляем через WebSocket
  let delivered = false;
  if (chatId) {
    delivered = sendMessageToRoom(chatId, messageData);
  } else {
    delivered = sendMessageToUser(to, messageData);
  }

  return {
    id: messageId,
    ...messageData,
    delivered
  };
};

/**
 * Отметить сообщения как прочитанные
 */
const markAsRead = async (from, to) => {
  console.log(`📖 markAsRead: from=${from}, to=${to}`);
  const result = await db.markMessagesAsRead(from, to);
  console.log(`  📊 Обновлено строк в БД: ${result.changes}`);
  
  // Уведомляем отправителя через WebSocket
  const sent = notifyMessageUpdate(from, 'messages_read', {
    byUserId: to,
    timestamp: Date.now()
  });
  console.log(`  📡 Уведомление отправлено: ${sent}`);
  
  return result;
};

/**
 * Переслать сообщение
 */
const forward = async (from, to, messageId) => {
  const { v4: uuidv4 } = require('uuid');
  
  const originalMessage = await db.getMessageById(messageId);
  if (!originalMessage) {
    return { error: 'Сообщение не найдено' };
  }

  const newMessageId = uuidv4();
  const timestamp = Date.now();
  const forwardedText = `📎 Переслано: ${originalMessage.text}`;

  await db.createMessage(
    newMessageId,
    from,
    to,
    forwardedText,
    timestamp,
    null,
    originalMessage.from_user,
    null
  );

  const delivered = sendMessageToUser(to, {
    id: newMessageId,
    from: from,
    to: to,
    text: forwardedText,
    timestamp: timestamp,
    read: 0,
    forwarded_from: originalMessage.from_user
  });

  return { 
    id: newMessageId, 
    delivered,
    forwarded_from: originalMessage.from_user
  };
};

module.exports = {
  createAndSend,
  markAsRead,
  forward,
  isMessageDuplicate,
  markMessageAsProcessed
};
