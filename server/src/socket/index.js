const WebSocket = require('ws');
const { verifyToken } = require('../middleware/auth');

// Хранилище активных подключений
const clients = new Map();

const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false,
  });

  wss.on('connection', (ws, req) => {
    console.log('🔌 Новое WebSocket соединение');

    let currentUserId = null;

    ws.on('message', async (data) => {
      try {
        if (!data || data.length === 0) return;
        
        const parsed = JSON.parse(data.toString());
        console.log('📩 Получено сообщение:', parsed.type);

        switch (parsed.type) {
          case 'auth': {
            if (!parsed.token) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Токен не предоставлен' 
              }));
              ws.close(1008, 'No token');
              return;
            }

            const decoded = verifyToken(parsed.token);
            if (!decoded) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Недействительный токен' 
              }));
              ws.close(1008, 'Invalid token');
              return;
            }

            currentUserId = decoded.userId;
            
            // Закрываем старое соединение если есть
            if (clients.has(currentUserId)) {
              const oldWs = clients.get(currentUserId);
              if (oldWs && oldWs.readyState === WebSocket.OPEN) {
                oldWs.close(1000, 'Duplicate connection');
              }
            }
            
            clients.set(currentUserId, ws);
            
            // Отправляем подтверждение авторизации
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              userId: currentUserId 
            }));

            // 🔥 ФИКС 1: Отправляем статус ВСЕМ пользователям
            broadcastStatus(currentUserId, true);
            
            // 🔥 ФИКС 2: Отправляем обновлённый список онлайн ВСЕМ пользователям
            broadcastOnlineUsers();
            
            // 🔥 ФИКС 3: Отправляем новому пользователю статусы ВСЕХ остальных
            sendAllStatuses(ws);
            
            console.log(`✅ Пользователь ${currentUserId} авторизован (клиентов: ${clients.size})`);
            break;
          }

          case 'typing': {
            const targetWs = clients.get(parsed.to);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'typing',
                from: parsed.from
              }));
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

    ws.on('close', (code, reason) => {
      console.log(`🔌 Соединение закрыто: ${code} - ${reason || 'Без причины'}`);
      if (currentUserId) {
        clients.delete(currentUserId);
        // 🔥 ФИКС: Отправляем статус ВСЕМ при выходе
        broadcastStatus(currentUserId, false);
        broadcastOnlineUsers();
        console.log(`📊 Клиентов осталось: ${clients.size}`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket ошибка:', error);
    });

    // Ping для проверки соединения
    const pingInterval = setInterval(() => {
      clients.forEach((client, userId) => {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        } else {
          // Если клиент мёртв — удаляем
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

// 🔥 ФИКС 4: Отправка статусов всех пользователей новому клиенту
const sendAllStatuses = (ws) => {
  const statuses = Array.from(clients.keys()).map(userId => ({
    userId,
    online: true,
    last_seen: Date.now()
  }));

  // Отправляем статусы по одному
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
  
  console.log(`📡 Отправлены статусы ${statuses.length} пользователей новому клиенту`);
};

// 🔥 ИСПРАВЛЕННАЯ РАССЫЛКА СТАТУСА
const broadcastStatus = (userId, isOnline) => {
  const statusMessage = JSON.stringify({
    type: 'status',
    userId: userId,
    online: isOnline,
    last_seen: Date.now()
  });

  console.log(`📡 Рассылка статуса: ${userId} -> ${isOnline ? 'онлайн' : 'оффлайн'}, клиентов: ${clients.size}`);

  // Отправляем ВСЕМ клиентам
  let sentCount = 0;
  clients.forEach((client, clientId) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(statusMessage);
      sentCount++;
      console.log(`📤 Статус отправлен клиенту: ${clientId}`);
    }
  });
  console.log(`📤 Статус отправлен ${sentCount} клиентам`);
};

// 🔥 ИСПРАВЛЕННАЯ РАССЫЛКА СПИСКА ОНЛАЙН
const broadcastOnlineUsers = () => {
  const onlineUsers = Array.from(clients.keys());
  const message = JSON.stringify({
    type: 'online_users',
    users: onlineUsers
  });
  
  console.log(`📡 Рассылка списка онлайн (${onlineUsers.length} пользователей):`, onlineUsers);

  let sentCount = 0;
  clients.forEach((client, clientId) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
      console.log(`📤 Список онлайн отправлен клиенту: ${clientId}`);
    }
  });
  console.log(`📤 Список онлайн отправлен ${sentCount} клиентам`);
};

// Отправка сообщения получателю
const sendMessageToUser = (to, messageData) => {
  const recipientWs = clients.get(to);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({
      type: 'message',
      ...messageData
    }));
    return true;
  }
  console.log(`⚠️ Получатель ${to} не в сети`);
  return false;
};

// Уведомление об обновлении сообщения
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

// Рассылка реакции
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

module.exports = {
  setupWebSocket,
  clients,
  sendMessageToUser,
  notifyMessageUpdate,
  broadcastReaction,
  broadcastStatus,
  broadcastOnlineUsers,
  sendAllStatuses
};