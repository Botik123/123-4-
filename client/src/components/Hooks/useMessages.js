import { useState, useCallback } from 'react';
import { messagesAPI } from '../../api';
import { getCleanText } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

export const useMessages = (userId, otherUserId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingMessages, setPendingMessages] = useState({});

  const loadHistory = useCallback(async (userId, otherUserId) => {
    if (!userId || !otherUserId) return;
    
    setLoading(true);
    try {
      const data = await messagesAPI.getHistory(userId, otherUserId);
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (to, text, replyTo, chatId) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('sendMessage: invalid recipient', to);
      return;
    }

    // Генерируем уникальный clientId
    const clientId = uuidv4();
    const tempId = `temp-${clientId}`;
    
    try {
      const newMsg = {
        id: tempId,
        from_user: userId,
        to_user: recipientId,
        text,
        timestamp: Date.now(),
        read: 0,
        reply_to: replyTo || null,
        reactions: {},
        clientId: clientId,
        pending: true
      };
      
      setMessages(prev => [...prev, newMsg]);
      setPendingMessages(prev => ({ ...prev, [clientId]: true }));

      const result = await messagesAPI.send(recipientId, text, replyTo, chatId, clientId);
      
      // Обработка дубликатов
      if (result.alreadyProcessed) {
        console.log('⚠️ Сообщение уже обработано, удаляем дубликат');
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setPendingMessages(prev => {
          const newState = { ...prev };
          delete newState[clientId];
          return newState;
        });
        return;
      }
      
      // Обновляем ID сообщения
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, id: result.id, pending: false } : msg
      ));
      
      setPendingMessages(prev => {
        const newState = { ...prev };
        delete newState[clientId];
        return newState;
      });
      
      return result;
    } catch (error) {
      console.error('Error sending message:', error);
      // Удаляем временное сообщение при ошибке
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setPendingMessages(prev => {
        const newState = { ...prev };
        delete newState[clientId];
        return newState;
      });
      alert('Ошибка отправки сообщения');
    }
  }, [userId]);

  const editMessage = useCallback(async (messageId, text, to) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('editMessage: invalid recipient', to);
      alert('Ошибка: не указан получатель');
      return;
    }

    if (!text || text.trim() === '') {
      alert('Сообщение не может быть пустым');
      return;
    }

    try {
      await messagesAPI.edit(messageId, text.trim(), recipientId);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, text: text.trim(), edited: true } : msg
      ));
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Ошибка редактирования');
    }
  }, []);

  const deleteMessage = useCallback(async (messageId, to) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('deleteMessage: invalid recipient', to);
      return;
    }

    try {
      await messagesAPI.delete(messageId, recipientId);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, text: '🗑️ Сообщение удалено', deleted: true } : msg
      ));
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Ошибка удаления');
    }
  }, []);

  const forwardMessage = useCallback(async (to, messageId) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('forwardMessage: invalid recipient', to);
      return;
    }

    try {
      const originalMsg = messages.find(m => m.id === messageId);
      if (!originalMsg) {
        alert('Сообщение не найдено');
        return;
      }

      const cleanText = getCleanText(originalMsg.text);
      const forwardText = `📎 Переслано: ${cleanText || originalMsg.text}`;

      const result = await sendMessage(recipientId, forwardText);
      return result;
    } catch (error) {
      console.error('Error forwarding message:', error);
      alert('Ошибка пересылки');
    }
  }, [messages, sendMessage]);

  const addReaction = useCallback(async (messageId, reaction, to) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('addReaction: invalid recipient', to);
      return;
    }

    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        if (reactions[userId] === reaction) {
          delete reactions[userId];
        } else {
          reactions[userId] = reaction;
        }
        return { ...msg, reactions };
      }
      return msg;
    }));

    try {
      await messagesAPI.addReaction(messageId, reaction, recipientId);
    } catch (error) {
      console.error('Error adding reaction:', error);
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          delete reactions[userId];
          return { ...msg, reactions };
        }
        return msg;
      }));
    }
  }, [userId]);

  const addMessage = useCallback((message) => {
    setMessages(prev => {
      if (prev.find(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  const updateMessage = useCallback((messageId, updates) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  const removeMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const markAsRead = useCallback(async (from) => {
    if (!from) return;
    
    try {
      await messagesAPI.markAsRead(from);
      setMessages(prev => prev.map(msg => 
        msg.from_user === from && msg.to_user === userId ? { ...msg, read: 1 } : msg
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [userId]);

  return {
    messages,
    loading,
    loadHistory,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    addReaction,
    addMessage,
    updateMessage,
    removeMessage,
    markAsRead,
    pendingMessages
  };
};