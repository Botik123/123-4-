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
        broadcastStatus(currentUserId, false);
        console.log(`📊 Клиентов осталось: ${clients.size}`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket ошибка:', error);
    });

    // Ping для проверки соединения
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  return wss;
};

// Рассылка статуса
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
  broadcastStatus
};