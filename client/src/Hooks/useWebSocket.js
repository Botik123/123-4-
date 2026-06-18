import { useState, useRef, useEffect } from 'react';
import { WS_URL } from '../../utils/constants';

export const useWebSocket = ({ 
  onMessage, 
  onMessageEdited, 
  onMessageDeleted,
  onReaction,
  onStatus,
  onNewUser
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const connect = (userId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setIsConnecting(true);
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnecting(false);
      setIsConnected(true);
      socket.send(JSON.stringify({ 
        type: 'auth', 
        token: localStorage.getItem('token') 
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
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
          case 'status':
            onStatus?.(data);
            break;
          case 'new_user':
            onNewUser?.(data);
            break;
          case 'error':
            console.error('Server error:', data.message);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket disconnected', event.code);
      setIsConnected(false);
      setIsConnecting(false);
      
      // Переподключение через 3 секунды
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimerRef.current = setTimeout(() => {
          if (localStorage.getItem('token')) {
            connect(userId);
          }
        }, 3000);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnecting(false);
    };

    wsRef.current = socket;
  };

  const disconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User logout');
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  };

  const send = (data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  const sendTyping = (to) => {
    send({ type: 'typing', to });
  };

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []);

  return {
    isConnecting,
    isConnected,
    connect,
    disconnect,
    send,
    sendTyping
  };
};