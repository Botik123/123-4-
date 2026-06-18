const WebSocket = require('ws');
const { verifyToken } = require('../middleware/auth');

// Хранилище активных подключений
const clients = new Map();
// Хранилище комнат (chatId -> Set of userIds)
const rooms = new Map();

const authenticateWebSocket = (ws, req) => {
  return new Promise((resolve, reject) => {
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
    let currentRoom = null;

    try {
      currentUserId = await authenticateWebSocket(ws, req);
      
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
          
          case 'leave_room': {
            const { chatId } = parsed;
            if (chatId && rooms.has(chatId)) {
              rooms.get(chatId).delete(currentUserId);
              console.log(`📌 Пользователь ${currentUserId} покинул комнату ${chatId}`);
            }
            break;
          }

          case 'typing': {
            const { to, chatId } = parsed;
            if (chatId && rooms.has(chatId)) {
              const roomUsers = rooms.get(chatId);
              roomUsers.forEach(userId => {
                if (userId !== currentUserId) {
                  const targetWs = clients.get(userId);
                  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                      type: 'typing',
                      from: parsed.from
                    }));
                  }
                }
              });
            } else {
              const targetWs = clients.get(to);
              if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'typing',
                  from: parsed.from
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

    ws.on('close', (code, reason) => {
      console.log(`🔌 Соединение закрыто: ${code} - ${reason || 'Без причины'}`);
      
      if (currentUserId) {
        for (const [chatId, users] of rooms) {
          if (users.has(currentUserId)) {
            users.delete(currentUserId);
            console.log(`📌 Пользователь ${currentUserId} удалён из комнаты ${chatId}`);
            if (users.size === 0) {
              rooms.delete(chatId);
            }
          }
        }
        
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