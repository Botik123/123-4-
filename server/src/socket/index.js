const WebSocket = require('ws');
const { verifyToken } = require('../middleware/auth');

// Хранилище активных подключений
const clients = new Map();

// 🔥 ФИКС: Аутентификация при подключении
const authenticateWebSocket = (ws, req) => {
  return new Promise((resolve, reject) => {
    // Получаем токен из заголовка или URL
    const token = req.headers['sec-websocket-protocol'] || 
                   new URL(req.url, 'http://localhost').searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'Token required');
      return reject(new Error('Token required'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      ws.close(1008, 'Invalid token');
      return reject(new Error('Invalid token'));
    }

    resolve(decoded.userId);
  });
};

const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false,
  });

  wss.on('connection', async (ws, req) => {
    console.log('🔌 Новое WebSocket соединение');

    let currentUserId = null;

    // 🔥 ФИКС: Аутентификация при подключении
    try {
      currentUserId = await authenticateWebSocket(ws, req);
      
      // Закрываем старое соединение если есть
      if (clients.has(currentUserId)) {
        const oldWs = clients.get(currentUserId);
        if (oldWs && oldWs.readyState === WebSocket.OPEN) {
          oldWs.close(1000, 'Duplicate connection');
        }
      }
      
      clients.set(currentUserId, ws);
      
      ws.send(JSON.stringify({ 
        type: 'auth_success', 
        userId: currentUserId 
      }));

      broadcastStatus(currentUserId, true);
      broadcastOnlineUsers();
      sendAllStatuses(ws);
      
      console.log(`✅ Пользователь ${currentUserId} авторизован (клиентов: ${clients.size})`);

    } catch (error) {
      console.error('❌ Ошибка авторизации:', error.message);
      ws.close(1008, error.message);
      return;
    }

    // Обработка сообщений
    ws.on('message', async (data) => {
      try {
        if (!data || data.length === 0) return;
        const parsed = JSON.parse(data.toString());
        
        switch (parsed.type) {
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

    // 🔥 ФИКС: Удаление при отключении
    ws.on('close', (code, reason) => {
      console.log(`🔌 Соединение закрыто: ${code} - ${reason || 'Без причины'}`);
      if (currentUserId) {
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

    // Ping для проверки соединения
    const pingInterval = setInterval(() => {
      clients.forEach((client, userId) => {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        } else {
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

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

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
  sendAllStatuses,
  broadcastNewUser
};