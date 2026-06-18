import { useState, useCallback } from 'react';
import { messagesAPI } from '../../api';

export const useMessages = (userId, otherUserId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const sendMessage = useCallback(async (to, text, replyTo) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('sendMessage: invalid recipient', to);
      return;
    }

    const tempId = Date.now();
    
    try {
      const newMsg = {
        id: tempId,
        from_user: userId,
        to_user: recipientId,
        text,
        timestamp: Date.now(),
        read: 0,
        reply_to: replyTo || null,
        reactions: {}
      };
      
      setMessages(prev => [...prev, newMsg]);
      
      const result = await messagesAPI.send(recipientId, text, replyTo);
      
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, id: result.id } : msg
      ));
      
      return result;
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
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
      const result = await messagesAPI.forward(recipientId, messageId);
      return result;
    } catch (error) {
      console.error('Error forwarding message:', error);
      alert('Ошибка пересылки');
    }
  }, []);

  const addReaction = useCallback(async (messageId, reaction, to) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('addReaction: invalid recipient', to);
      return;
    }

    try {
      await messagesAPI.addReaction(messageId, reaction, recipientId);
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
    } catch (error) {
      console.error('Error adding reaction:', error);
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
    markAsRead
  };
};