/**
 * @file client/src/components/Hooks/useMessages.js
 * @description Custom hook для управления сообщениями
 * Отправка, получение, редактирование, удаление, реакции
 */

import { useState, useCallback, useRef } from 'react';
import { messagesAPI } from '../../api';
import { getCleanText } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

export const useMessages = (userId, otherUserId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingMessages, setPendingMessages] = useState({});
  
  // Ref для доступа к актуальным сообщениям вне замыкания
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Ref для хранения текущего собеседника (для фильтрации WebSocket сообщений)
  const currentChatRef = useRef({ userId, otherUserId });
  currentChatRef.current = { userId, otherUserId };

  /**
   * Загрузка истории сообщений между пользователями
   * Очищает предыдущие сообщения при смене чата
   */
  const loadHistory = useCallback(async (userId, otherUserId) => {
    if (!userId || !otherUserId) return;
    
    setLoading(true);
    try {
      const data = await messagesAPI.getHistory(userId, otherUserId);
      // Очищаем сообщения перед загрузкой новых (чтобы не смешивались чаты)
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Очистить сообщения при смене чата
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * Отправка сообщения с оптимистичным обновлением
   * @param {string|object} to - ID или объект получателя
   * @param {string} text - Текст сообщения
   * @param {string|null} replyTo - ID сообщения для ответа
   * @param {string|null} chatId - ID комнаты (если есть)
   */
  const sendMessage = useCallback(async (to, text, replyTo, chatId) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('sendMessage: invalid recipient', to);
      return;
    }

    // Генерируем уникальный clientId для идемпотентности
    const clientId = uuidv4();
    const tempId = `temp-${clientId}`;
    
    try {
      // Создаём временное сообщение для мгновенного отображения
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
      
      // Оптимистично добавляем в список
      setMessages(prev => [...prev, newMsg]);
      setPendingMessages(prev => ({ ...prev, [clientId]: true }));

      const result = await messagesAPI.send(recipientId, text, replyTo, chatId, clientId);
      
      // Обработка дубликатов (сервер отклонил)
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

      // Заменяем временный ID на реальный от сервера
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

  /**
   * Редактирование сообщения
   */
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

  /**
   * Удаление сообщения (мягкое - помечается как удалённое)
   */
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

  /**
   * Пересылка сообщения другому пользователю
   * Использует messagesRef для доступа к актуальным данным
   */
  const forwardMessage = useCallback(async (to, messageId) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('forwardMessage: invalid recipient', to);
      return;
    }

    try {
      // Используем ref для доступа к актуальным сообщениям
      const originalMsg = messagesRef.current.find(m => m.id === messageId);
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
  }, [sendMessage]);

  /**
   * Добавление/удаление реакции на сообщение
   */
  const addReaction = useCallback(async (messageId, reaction, to) => {
    const recipientId = typeof to === 'string' ? to : to?.id || to;
    if (!recipientId) {
      console.error('addReaction: invalid recipient', to);
      return;
    }

    // Оптимистичное обновление UI (с созданием нового объекта reactions)
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const oldReactions = msg.reactions || {};
        // Создаём новый объект вместо мутации
        const newReactions = { ...oldReactions };
        if (newReactions[userId] === reaction) {
          delete newReactions[userId];
        } else {
          newReactions[userId] = reaction;
        }
        return { ...msg, reactions: newReactions };
      }
      return msg;
    }));

    try {
      await messagesAPI.addReaction(messageId, reaction, recipientId);
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Откат при ошибке
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const oldReactions = msg.reactions || {};
          const newReactions = { ...oldReactions };
          delete newReactions[userId];
          return { ...msg, reactions: newReactions };
        }
        return msg;
      }));
    }
  }, [userId]);

  /**
   * Добавить сообщение из WebSocket (полученное от других)
   * Фильтрует сообщения только для текущего чата
   */
  const addMessage = useCallback((message) => {
    const { userId: currentUserId, otherUserId: currentOtherId } = currentChatRef.current;
    
    // Проверяем, относится ли сообщение к текущему чату
    const isRelatedToCurrentChat = 
      (message.from === currentUserId && message.to === currentOtherId) ||
      (message.from === currentOtherId && message.to === currentUserId);
    
    if (!isRelatedToCurrentChat) {
      // Сообщение не относится к текущему чату - игнорируем
      return;
    }
    
    setMessages(prev => {
      if (prev.find(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  /**
   * Обновить существующее сообщение
   */
  const updateMessage = useCallback((messageId, updates) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  /**
   * Удалить сообщение из списка
   */
  const removeMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  /**
   * Отметить сообщения от пользователя как прочитанные
   */
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
    clearMessages,
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