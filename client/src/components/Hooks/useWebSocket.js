import { useState, useRef, useEffect, useCallback } from 'react';
import { WS_URL } from '../../utils/constants';

export const useWebSocket = ({ 
  onMessage, 
  onMessageEdited, 
  onMessageDeleted,
  onReaction,
  onStatus,
  onNewUser,
  onOnlineUsers // Добавляем новый обработчик
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const isMounted = useRef(true);

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

  const connect = useCallback((userId) => {
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
      console.warn('⚠️ Нет токена');
      return;
    }

    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.warn('⚠️ Достигнут лимит попыток');
      return;
    }

    setIsConnecting(true);
    reconnectAttempts.current += 1;

    try {
      console.log(`🔌 Подключение к WebSocket (попытка ${reconnectAttempts.current}/${maxReconnectAttempts})`);
      
      const socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        if (!isMounted.current) return;
        console.log('✅ WebSocket connected');
        setIsConnecting(false);
        setIsConnected(true);
        reconnectAttempts.current = 0;
        socket.send(JSON.stringify({ type: 'auth', token: token }));
      };

      socket.onmessage = (event) => {
        if (!isMounted.current) return;
        try {
          const data = JSON.parse(event.data);
          console.log('📩 WebSocket получено:', data.type);
          
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
              // Обработка списка онлайн пользователей
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
  }, [isConnecting, onMessage, onMessageEdited, onMessageDeleted, onReaction, onStatus, onNewUser, onOnlineUsers]);

  const disconnect = useCallback(() => {
    console.log('🔌 Отключение WebSocket');
    reconnectAttempts.current = 0;
    cleanup();
  }, [cleanup]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('⚠️ WebSocket не открыт');
    return false;
  }, []);

  const sendTyping = useCallback((to) => {
    send({ type: 'typing', to });
  }, [send]);

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
    sendTyping
  };
};