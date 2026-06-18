/**
 * @file server/src/socket/index.js
 * @description WebSocket сервер для real-time общения
 * Обработка подключений, аутентификация, комнаты, статусы пользователей
 */

const WebSocket = require('ws');
const { verifyToken } = require('../middleware/auth');

// Хранилище активных подключений: userId -> WebSocket
const clients = new Map();
// Хранилище комнат: chatId -> Set<userId>
const rooms = new Map();

/**
 * Настройка WebSocket сервера
 * @param {http.Server} server - HTTP сервер для совместного использования порта
 */
const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false, // Отключаем сжатие для производительности
  });

  wss.on('connection', async (ws, req) => {
    console.log('🔌 Новое WebSocket соединение');

    let currentUserId = null;
    let currentRoom = null;

    // ==========================================
    // 🔥 АУТЕНТИФИКАЦИЯ ПОЛЬЗОВАТЕЛЯ
    // ==========================================
    ws.on('message', async (data) => {
      try {
        // Защита от пустых и невалидных сообщений
        if (!data || data.length === 0 || !data.toString().trim()) return;
        const parsed = JSON.parse(data.toString());
        
        // Обработка сообщения аутентификации
        if (parsed.type === 'auth' && !currentUserId) {
          const token = parsed.token;
          if (!token) {
            ws.send(JSON.stringify({ type: 'error', message: 'Token required' }));
            return;
          }
          
          // Верификация JWT токена
          const decoded = verifyToken(token);
          if (!decoded) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            ws.close(1008, 'Invalid token');
            return;
          }
          
          currentUserId = decoded.userId;
          
          // Заменяем старое соединение если есть (защита от дубликатов)
          if (clients.has(currentUserId)) {
            const oldWs = clients.get(currentUserId);
            if (oldWs && oldWs.readyState === WebSocket.OPEN) {
              oldWs.close(1000, 'Duplicate connection');
            }
          }
          
          clients.set(currentUserId, ws);
          
          // Подтверждение аутентификации
          ws.send(JSON.stringify({ 
            type: 'auth_success', 
            userId: currentUserId 
          }));

          // Уведомляем всех о статусе пользователя
          broadcastStatus(currentUserId, true);
          broadcastOnlineUsers();
          sendAllStatuses(ws);
          
          console.log(`✅ Пользователь ${currentUserId} авторизован (клиентов: ${clients.size})`);
          return;
        }
        
        // ==========================================
        // 🔥 ОБРАБОТКА КОМНАТ И СОБЫТИЙ
        // ==========================================
        switch (parsed.type) {
          // Вход в комнату чата
          case 'join_room': {
            const { chatId } = parsed;
            if (!chatId) {
              ws.send(JSON.stringify({ type: 'error', message: 'chatId required' }));
              return;
            }
            
            currentRoom = chatId;
            
            if (!rooms.has(chatId)) {
              rooms.set(chatId, new Set());
            }
            rooms.get(chatId).add(currentUserId);
            
            console.log(`📌 Пользователь ${currentUserId} вошёл в комнату ${chatId}`);
            ws.send(JSON.stringify({ type: 'room_joined', chatId }));
            break;
          }
          
          // Выход из комнаты
          case 'leave_room': {
            const { chatId } = parsed;
            if (chatId && rooms.has(chatId)) {
              rooms.get(chatId).delete(currentUserId);
              console.log(`📌 Пользователь ${currentUserId} покинул комнату ${chatId}`);
              ws.send(JSON.stringify({ type: 'room_left', chatId }));
            }
            break;
          }

          // Индикатор набора текста
          case 'typing': {
            const { to, chatId, typing } = parsed;
            // Игнорируем сообщения без флага typing для обратной совместимости
            if (typing === false) {
              // Сообщение о прекращении набора - ничего не отправляем
              break;
            }
            
            // Рассылка пользователям в комнате
            if (chatId && rooms.has(chatId)) {
              const roomUsers = rooms.get(chatId);
              roomUsers.forEach(userId => {
                if (userId !== currentUserId) {
                  const targetWs = clients.get(userId);
                  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                      type: 'typing',
                      from: currentUserId,
                      isTyping: typing !== false
                    }));
                  }
                }
              });
            } else {
              // Личное сообщение
              const targetWs = clients.get(to);
              if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'typing',
                  from: currentUserId,
                  isTyping: typing !== false
                }));
              }
            }
            break;
          }

          default:
            console.log('Неизвестный тип:', parsed.type);
        }
      } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Ошибка обработки запроса' 
        }));
      }
    });

    // ==========================================
    // ОБРАБОТКА ЗАКРЫТИЯ СОЕДИНЕНИЯ
    // ==========================================
    ws.on('close', (code, reason) => {
      console.log(`🔌 Соединение закрыто: ${code} - ${reason || 'Без причины'}`);
      
      if (currentUserId) {
        // Удаляем пользователя из всех комнат
        for (const [chatId, users] of rooms) {
          if (users.has(currentUserId)) {
            users.delete(currentUserId);
            if (users.size === 0) {
              rooms.delete(chatId);
            }
          }
        }
        
        // Удаляем из активных подключений
        clients.delete(currentUserId);
        broadcastStatus(currentUserId, false);
        broadcastOnlineUsers();
        console.log(`📊 Клиентов осталось: ${clients.size}`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket ошибка:', error);
      if (currentUserId) {
        clients.delete(currentUserId);
        broadcastStatus(currentUserId, false);
        broadcastOnlineUsers();
      }
    });

    // ==========================================
    // PING для поддержания соединения (каждые 30 сек)
    // ==========================================
    const pingInterval = setInterval(() => {
      // Проверяем только другие подключения, не текущее
      clients.forEach((client, userId) => {
        if (client !== ws || client.readyState !== WebSocket.OPEN) {
          clients.delete(userId);
          broadcastStatus(userId, false);
          broadcastOnlineUsers();
        }
      });
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  return wss;
};

// ==========================================
// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======
// ==========================================

/**
 * Отправить сообщение всем пользователям в комнате
 * @param {string} chatId - ID комнаты
 * @param {object} messageData - Данные сообщения
 * @returns {boolean} Удалось ли доставить хотя бы одному пользователю
 */
const sendMessageToRoom = (chatId, messageData) => {
  const roomUsers = rooms.get(chatId);
  if (!roomUsers) {
    console.log(`⚠️ Комната ${chatId} не найдена`);
    return false;
  }

  let sentCount = 0;
  roomUsers.forEach(userId => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'message',
        ...messageData
      }));
      sentCount++;
    }
  });
  
  console.log(`📤 Сообщение отправлено в комнату ${chatId}, доставлено: ${sentCount}`);
  return sentCount > 0;
};

/**
 * Отправить сообщение конкретному пользователю
 * @param {string} to - ID получателя
 * @param {object} messageData - Данные сообщения
 * @returns {boolean} Удалось ли доставить
 */
const sendMessageToUser = (to, messageData) => {
  const recipientWs = clients.get(to);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({
      type: 'message',
      ...messageData
    }));
    return true;
  }
  return false;
};

/**
 * Уведомить пользователя об изменении сообщения
 * @param {string} to - ID получателя
 * @param {string} type - Тип события (message_edited/message_deleted)
 * @param {object} data - Данные события
 */
const notifyMessageUpdate = (to, type, data) => {
  const recipientWs = clients.get(to);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({
      type: type,
      ...data
    }));
    return true;
  }
  return false;
};

/**
 * Отправить реакцию пользователю
 */
const broadcastReaction = (messageId, userId, reaction, targetUserId) => {
  const targetWs = clients.get(targetUserId);
  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
    targetWs.send(JSON.stringify({
      type: 'reaction',
      messageId: messageId,
      userId: userId,
      reaction: reaction
    }));
  }
};

/**
 * Уведомить всех о новом пользователе (после регистрации)
 */
const broadcastNewUser = (userData) => {
  const message = JSON.stringify({
    type: 'new_user',
    user: userData
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

/**
 * Отправить все текущие статусы новому подключению
 */
const sendAllStatuses = (ws) => {
  const statuses = Array.from(clients.keys()).map(userId => ({
    userId,
    online: true,
    last_seen: Date.now()
  }));

  statuses.forEach(status => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status',
        userId: status.userId,
        online: status.online,
        last_seen: status.last_seen
      }));
    }
  });
};

/**
 * Транслировать изменение статуса пользователя всем
 * @param {string} userId - ID пользователя
 * @param {boolean} isOnline - Статус онлайн/оффлайн
 */
const broadcastStatus = (userId, isOnline) => {
  const statusMessage = JSON.stringify({
    type: 'status',
    userId: userId,
    online: isOnline,
    last_seen: Date.now()
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(statusMessage);
    }
  });
};

/**
 * Отправить список всех онлайн пользователей
 */
const broadcastOnlineUsers = () => {
  const onlineUsers = Array.from(clients.keys());
  const message = JSON.stringify({
    type: 'online_users',
    users: onlineUsers
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

module.exports = {
  setupWebSocket,
  clients,
  rooms,
  sendMessageToUser,
  sendMessageToRoom,
  notifyMessageUpdate,
  broadcastReaction,
  broadcastStatus,
  broadcastOnlineUsers,
  sendAllStatuses,
  broadcastNewUser
};