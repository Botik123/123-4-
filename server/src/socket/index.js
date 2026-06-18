const WebSocket = require('ws');
const redis = require('../redis');
const db = require('../db/queries');
const { verifyToken } = require('../middleware/auth');

// Хранилище активных подключений
const clients = new Map();

const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    let currentUserId = null;

    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data);

        switch (parsed.type) {
          case 'auth': {
            const decoded = verifyToken(parsed.token);
            if (!decoded) {
              ws.send(JSON.stringify({ type: 'error', message: 'Недействительный токен' }));
              ws.close();
              return;
            }

            currentUserId = decoded.userId;
            clients.set(currentUserId, ws);
            
            // Сохраняем статус в Redis
            await redis.set(`user:${currentUserId}:online`, 'true', { EX: 60 });
            await redis.set(`user:${currentUserId}:last_seen`, Date.now(), { EX: 60 });
            
            // Рассылаем статус
            broadcastStatus(currentUserId, true);
            broadcastNewUser(currentUserId);
            
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

          default: {
            console.log('Неизвестный тип сообщения:', parsed.type);
          }
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });

    ws.on('close', async () => {
      if (currentUserId) {
        clients.delete(currentUserId);
        await redis.del(`user:${currentUserId}:online`);
        await redis.set(`user:${currentUserId}:last_seen`, Date.now());
        broadcastStatus(currentUserId, false);
        console.log(`🔌 Пользователь ${currentUserId} отключился (клиентов: ${clients.size})`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
};

// Рассылка статуса
const broadcastStatus = async (userId, isOnline) => {
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

// Уведомление о новом пользователе
const broadcastNewUser = async (userId) => {
  try {
    const user = await db.getUserById(userId);
    if (!user) return;

    const message = JSON.stringify({
      type: 'new_user',
      user: user
    });

    clients.forEach((client, clientId) => {
      if (clientId !== userId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } catch (error) {
    console.error('Error broadcasting new user:', error);
  }
};

// Отправка сообщения получателю (вызывается из HTTP)
const sendMessageToUser = (from, to, messageData) => {
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

// Уведомление об удалении/редактировании
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
  broadcastStatus
};