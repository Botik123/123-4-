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
    try {
      const tempId = Date.now();
      const newMsg = {
        id: tempId,
        from_user: userId,
        to_user: to,
        text,
        timestamp: Date.now(),
        read: 0,
        reply_to: replyTo || null,
        reactions: {}
      };
      
      setMessages(prev => [...prev, newMsg]);
      
      const result = await messagesAPI.send(to, text, replyTo);
      
      // Обновляем ID сообщения
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, id: result.id } : msg
      ));
      
      return result;
    } catch (error) {
      console.error('Error sending message:', error);
      // Удаляем временное сообщение
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      alert('Ошибка отправки сообщения');
    }
  }, [userId]);

  const editMessage = useCallback(async (messageId, text, to) => {
    try {
      await messagesAPI.edit(messageId, text, to);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, text, edited: true } : msg
      ));
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Ошибка редактирования');
    }
  }, []);

  const deleteMessage = useCallback(async (messageId, to) => {
    try {
      await messagesAPI.delete(messageId, to);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, text: '🗑️ Сообщение удалено', deleted: true } : msg
      ));
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Ошибка удаления');
    }
  }, []);

  const addReaction = useCallback(async (messageId, reaction, to) => {
    try {
      await messagesAPI.addReaction(messageId, reaction, to);
      // Локальное обновление
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          // Toggle reaction
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
      // Проверяем, нет ли уже такого сообщения
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

  return {
    messages,
    loading,
    loadHistory,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    addMessage,
    updateMessage,
    removeMessage
  };
};