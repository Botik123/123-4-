/**
 * @file client/src/components/Hooks/useWebSocket.js
 * @description Custom hook для WebSocket соединения
 * Управление подключением, переподключением, обработкой событий
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { WS_URL } from '../../utils/constants';

/**
 * @param {object} callbacks - Объект с обработчиками событий
 * @param {function} callbacks.onMessage - Новое сообщение
 * @param {function} callbacks.onMessageEdited - Сообщение отредактировано
 * @param {function} callbacks.onMessageDeleted - Сообщение удалено
 * @param {function} callbacks.onReaction - Реакция на сообщение
 * @param {function} callbacks.onMessagesRead - Сообщения прочитаны
 * @param {function} callbacks.onStatus - Изменение статуса пользователя
 * @param {function} callbacks.onNewUser - Новый пользователь
 * @param {function} callbacks.onOnlineUsers - Список онлайн пользователей
 */
export const useWebSocket = ({ 
  onMessage, 
  onMessageEdited, 
  onMessageDeleted,
  onReaction,
  onMessagesRead,
  onStatus,
  onNewUser,
  onOnlineUsers
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3; // Лимит попыток переподключения
  const isMounted = useRef(true); // Флаг смонтированности компонента

  /**
   * Очистка ресурсов при отключении
   */
  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Cleanup');
      } catch (e) {}
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Подключение к WebSocket серверу
   * @param {string} userId - ID пользователя для аутентификации
   */
  const connect = useCallback((userId) => {
    // Если уже подключены - не подключаемся повторно
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket уже подключен');
      return;
    }

    if (isConnecting) {
      console.log('⏳ Уже в процессе подключения');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ Нет токена для WebSocket');
      setIsConnecting(false);
      return;
    }

    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.warn('⚠️ Достигнут лимит попыток');
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    reconnectAttempts.current += 1;

    try {
      console.log(`🔌 Подключение к WebSocket (попытка ${reconnectAttempts.current}/${maxReconnectAttempts})`);
      
      const socket = new WebSocket(`${WS_URL}?token=${token}`);

      socket.onopen = () => {
        if (!isMounted.current) return;
        console.log('✅ WebSocket connected');
        setIsConnecting(false);
        setIsConnected(true);
        reconnectAttempts.current = 0;
        // Отправляем токен для аутентификации
        socket.send(JSON.stringify({ type: 'auth', token: token }));
      };

      socket.onmessage = (event) => {
        if (!isMounted.current) return;
        try {
          const data = JSON.parse(event.data);
          console.log('📩 WebSocket получено:', data.type);
          
          // Обработка типов сообщений от сервера
          switch (data.type) {
            case 'auth_success':
              console.log('✅ Аутентификация успешна');
              break;
            case 'message':
              onMessage?.(data);
              break;
            case 'message_edited':
              onMessageEdited?.(data);
              break;
            case 'message_deleted':
              onMessageDeleted?.(data);
              break;
            case 'messages_read':
              console.log(`📖 Сообщения прочитаны: byUserId=${data.byUserId}`);
              onMessagesRead?.(data);
              break;
            case 'reaction':
              onReaction?.(data);
              break;
            case 'status': {
              console.log(`📡 Получен статус: пользователь ${data.userId} -> ${data.online ? 'онлайн' : 'оффлайн'}`);
              onStatus?.(data);
              }
              break;
            case 'new_user':
              onNewUser?.(data);
              break;
            case 'online_users':
              onOnlineUsers?.(data.users);
              break;
            case 'error':
              console.error('❌ Server error:', data.message);
              break;
            default:
              console.log('📨 Неизвестный тип:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      socket.onclose = (event) => {
        if (!isMounted.current) return;
        console.log(`🔌 WebSocket disconnected: ${event.code}`);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Не переподключаемся при нормальном закрытии
        if (event.code === 1000 || event.code === 1001 || event.code === 1006) {
          return;
        }
      };

      socket.onerror = (error) => {
        if (!isMounted.current) return;
        console.error('❌ WebSocket error:', error);
        setIsConnecting(false);
      };

      wsRef.current = socket;
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setIsConnecting(false);
    }
  }, [isConnecting, onMessage, onMessageEdited, onMessageDeleted, onReaction, onMessagesRead, onStatus, onNewUser, onOnlineUsers]);

  /**
   * Отключение от WebSocket
   */
  const disconnect = useCallback(() => {
    console.log('🔌 Отключение WebSocket');
    reconnectAttempts.current = 0;
    cleanup();
  }, [cleanup]);

  /**
   * Отправка произвольных данных через WebSocket
   */
  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('⚠️ WebSocket не открыт');
    return false;
  }, []);

  /**
   * Отправить событие начала набора текста
   */
  const sendTyping = useCallback((to) => {
    send({ type: 'typing', to });
  }, [send]);

  /**
   * Отправить событие начала набора (явный флаг)
   */
  const sendTypingStart = useCallback((to) => {
    send({ type: 'typing', to, typing: true });
  }, [send]);

  /**
   * Отправить событие прекращения набора
   */
  const sendTypingStop = useCallback((to) => {
    send({ type: 'typing', to, typing: false });
  }, [send]);

  // ==========================================
  // МОНТИРОВАНИЕ/РАЗМОНТИРОВАНИЕ КОМПОНЕНТА
  // ==========================================
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnecting,
    isConnected,
    connect,
    disconnect,
    send,
    sendTyping,
    sendTypingStart,
    sendTypingStop
  };
};