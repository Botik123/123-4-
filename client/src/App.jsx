/**
 * @file client/src/App.jsx
 * @description Главный компонент приложения мессенджера
 * Интеграция всех hooks и компонентов, управление состоянием
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import AuthForm from './components/Auth/AuthForm';
import Sidebar from './components/Sidebar/Sidebar';
import ChatArea from './components/Chat/ChatArea';
import { useAuth } from './components/Hooks/useAuth';
import { useWebSocket } from './components/Hooks/useWebSocket';
import { useMessages } from './components/Hooks/useMessages';
import { useUsers } from './components/Hooks/useUsers';
import { playMessageSound, playSendSound } from './utils/sounds';
import { parseFileMessage, getCleanText, getReplyPreview } from './utils/helpers';

function App() {
  // === СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // Выбранный собеседник
  const [replyTo, setReplyTo] = useState(null); // Сообщение для ответа
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false); // Мобильная версия
  const isConnectingRef = useRef(false); // Флаг подключения WebSocket

  // === AUTH HOOK ===
  const { user, loading: authLoading, login, register, logout } = useAuth();
  
  // === USERS HOOK ===
  const { 
    users, 
    loading: usersLoading, 
    fetchUsers,
    addUser,
    updateUserStatus,
    setUsers
  } = useUsers();
  
  // === MESSAGES HOOK ===
  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    addReaction,
    addMessage,
    updateMessage,
    removeMessage,
    loadHistory,
    clearMessages,
    markAsRead,
    setMessages
  } = useMessages(user?.id, selectedUser?.id);
  
  // === WEBSOCKET HOOK ===
  // Обработчики событий реального времени
  const {
    isConnecting,
    sendTypingStart,
    sendTypingStop,
    connect,
    disconnect
  } = useWebSocket({
    // Новое сообщение получено через WebSocket
    onMessage: (data) => {
      console.log(`📩 onMessage: from=${data.from}, to=${data.to}, current user=${user?.id}, selected=${selectedUser?.id}`);
      // Добавляем сообщение если оно для текущего чата
      addMessage(data);
      // Если сообщение от текущего собеседника и мы в этом чате - помечаем как прочитанное
      if (selectedUser && data.from === selectedUser.id && data.to === user?.id) {
        console.log(`✅ Помечаем сообщения от ${data.from} как прочитанные`);
        playMessageSound();
        handleMarkAsRead(data.from);
      }
    },
    // Сообщение отредактировано отправителем
    onMessageEdited: (data) => {
      updateMessage(data.messageId, { text: data.text, edited: true });
    },
    // Сообщение удалено
    onMessageDeleted: (data) => {
      updateMessage(data.messageId, { text: '🗑️ Сообщение удалено', deleted: true });
    },
    // Сообщения прочитаны (ответ от сервера)
    onMessagesRead: (data) => {
      console.log(`📖 onMessagesRead: byUserId=${data.byUserId}, current user=${user?.id}, messages count=${messages.length}`);
      // Обновляем галочки у сообщений которые МЫ отправили и ИХ прочитали
      // data.byUserId - это кто прочитал (собеседник)
      // Используем updateMessage для каждого сообщения
      let updatedCount = 0;
      messages.forEach(msg => {
        if (msg.from_user === user?.id && msg.to_user === data.byUserId && msg.read !== 1) {
          console.log(`  📩 Сообщение ${msg.id}: from=${msg.from_user}, to=${msg.to_user}, read=${msg.read} -> 1`);
          updateMessage(msg.id, { read: 1 });
          updatedCount++;
        }
      });
      console.log(`  ✅ Обновлено ${updatedCount} сообщений`);
    },
    // Реакция на сообщение (получена от другого пользователя)
    onReaction: (data) => {
      // data: { messageId, userId, reaction, to }
      // userId - кто поставил реакцию (не текущий пользователь)
      // Просто обновляем реакцию в UI без toggle
      console.log(`🎭 onReaction: userId=${data.userId}, reaction=${data.reaction}`);
      updateMessage(data.messageId, {
        reactions: {
          ...(messages.find(m => m.id === data.messageId)?.reactions || {}),
          [data.userId]: data.reaction
        }
      });
    },
    // Изменение статуса пользователя (онлайн/оффлайн) - от WebSocket
    onStatus: (data) => {
      console.log(`📡 onStatus: userId=${data.userId}, online=${data.online}, users.length=${users.length}`);
      
      // Обновляем через setUsers напрямую чтобы работало даже до загрузки users
      setUsers(prev => {
        if (!prev || prev.length === 0) {
          console.warn('⚠️ onStatus: users is empty');
          return prev || [];
        }
        const updated = prev.map(u => {
          if (u.id === data.userId) {
            console.log(`  ✅ Обновляем ${u.username}: ${u.online} -> ${data.online}`);
            return {
              ...u,
              online: data.online,
              last_seen: data.last_seen || Date.now()
            };
          }
          return u;
        });
        return updated;
      });
      
      // Обновляем selectedUser если это он
      if (selectedUser && selectedUser.id === data.userId) {
        setSelectedUser(prev => prev ? {
          ...prev,
          online: data.online,
          last_seen: data.last_seen || Date.now()
        } : null);
      }
    },
    // Новый пользователь зарегистрировался
    onNewUser: (data) => {
      console.log(`👤 onNewUser:`, data);
      // Не добавляем текущего пользователя
      if (data.user?.id && data.user.id !== user?.id) {
        addUser(data.user);
      }
    },
    // Список онлайн пользователей (при подключении)
    onOnlineUsers: (onlineUserIds) => {
      console.log(`📡 onOnlineUsers:`, onlineUserIds, `users.length=${users.length}`);
      
      const onlineSet = new Set(onlineUserIds);
      
      // Обновляем через setUsers напрямую
      setUsers(prev => {
        if (!prev || prev.length === 0) {
          console.warn('⚠️ onOnlineUsers: users is empty');
          return prev || [];
        }
        
        const updated = prev.map(u => {
          if (u.id !== user?.id) {
            const isOnline = onlineSet.has(u.id);
            console.log(`  📍 ${u.username}: ${u.online} -> ${isOnline}`);
            return {
              ...u,
              online: isOnline,
              last_seen: isOnline ? Date.now() : u.last_seen
            };
          }
          return u;
        });
        
        console.log(`  ✅ Обновлено статусов: ${updated.length}`);
        return updated;
      });
      
      // Обновляем selectedUser
      if (selectedUser) {
        setSelectedUser(prev => prev ? {
          ...prev,
          online: onlineSet.has(prev.id),
          last_seen: onlineSet.has(prev.id) ? Date.now() : prev.last_seen
        } : null);
      }
    }
  });

  // ==========================================
  // === EFFECTS: ЖИЗНЕННЫЙ ЦИКЛ ===
  // ==========================================
  
  // Подключаем WebSocket при авторизации пользователя
  useEffect(() => {
    if (user && !isConnectingRef.current) {
      isConnectingRef.current = true;
      // Сначала загружаем пользователей, потом подключаем WebSocket
      fetchUsers(user.id);
      connect(user.id);
    }
    return () => {
      if (user) {
        isConnectingRef.current = false;
        disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Загрузка истории сообщений при выборе пользователя
  useEffect(() => {
    if (selectedUser && user) {
      // Защита: не загружаем историю если выбран сам себя
      if (selectedUser.id === user.id) {
        console.warn('⚠️ Попытка выбрать самого себя, игнорируем');
        clearMessages();
        return;
      }
      
      // Очищаем сообщения перед загрузкой нового чата
      clearMessages();
      loadHistory(user.id, selectedUser.id);
      
      // На мобильных открываем чат при выборе
      if (window.innerWidth <= 768) {
        setIsMobileChatOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // Debug режим - доступ к данным через консоль браузера
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__debug = {
        parseFileMessage,
        getCleanText,
        getReplyPreview,
        getMessages: () => messages,
        getUsers: () => users,
        getSelectedUser: () => selectedUser,
        API_URL: 'http://localhost:3002',
        __debugUser: user
      };
      console.log('✅ Дебаг режим активирован! Используй window.__debug');
    }
  }, [messages, users, selectedUser, user]);

  // ==========================================
  // === ОБРАБОТЧИКИ СОБЫТИЙ ===
  // ==========================================
  
  // Выбор пользователя из списка
  const handleSelectUser = (user) => {
    // Защита: не даём выбрать самого себя
    if (user.id === window.__debugUser?.id) {
      console.warn('⚠️ Нельзя выбрать самого себя');
      return;
    }
    setSelectedUser(user);
    if (window.innerWidth <= 768) {
      setIsMobileChatOpen(true);
    }
  };

  // Кнопка "назад" для мобильных
  const handleBack = () => {
    if (window.innerWidth <= 768) {
      setIsMobileChatOpen(false);
    }
  };

  // Логин пользователя
  const handleLogin = async (username, password) => {
    const result = await login(username, password);
    if (!result.success) {
      alert(result.error);
    }
  };

  // Регистрация нового пользователя
  const handleRegister = async (username, password) => {
    const result = await register(username, password);
    if (!result.success) {
      alert(result.error);
    }
  };

  // Отправка сообщения
  const handleSendMessage = (text) => {
    if (!selectedUser) return;
    sendMessage(selectedUser.id, text, replyTo?.id);
    playSendSound();
    setReplyTo(null);
  };

  // Отправка файла (через текстовое представление)
  const handleFileSend = (fileText) => {
    if (!selectedUser) return;
    sendMessage(selectedUser.id, fileText);
    playSendSound();
  };

  // Пересылка сообщения
  const handleForwardMessage = (message) => {
    if (!selectedUser) return;
    forwardMessage(selectedUser.id, message.id);
  };

  // Редактирование сообщения
  const handleEditMessage = (message) => {
    if (!selectedUser) return;
    const newText = prompt('Редактировать сообщение:', message.text);
    if (newText && newText.trim()) {
      editMessage(message.id, newText.trim(), selectedUser.id);
    }
  };

  // Удаление сообщения (подтверждение в компоненте Message)
  const handleDeleteMessage = (messageId) => {
    if (!selectedUser) return;
    deleteMessage(messageId, selectedUser.id);
  };

  // Добавление реакции
  const handleAddReaction = (messageId, reaction) => {
    if (!selectedUser) return;
    addReaction(messageId, reaction, selectedUser.id);
  };

  // Индикатор набора текста
  const handleTyping = (isTyping) => {
    if (!selectedUser) return;
    if (isTyping) {
      sendTypingStart(selectedUser.id);
    } else {
      sendTypingStop(selectedUser.id);
    }
  };

  // Автоматическое прочтение сообщений при получении
  const handleMarkAsRead = useCallback((fromUserId) => {
    if (!fromUserId || !user?.id) return;
    console.log(`📖 handleMarkAsRead: fromUserId=${fromUserId}, user.id=${user.id}`);
    markAsRead(fromUserId);
  }, [user?.id, markAsRead]);

  // Переключение темы
  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
    document.documentElement.setAttribute('data-theme', !isDarkTheme ? 'dark' : 'light');
  };

  if (!user) {
    return (
      <AuthForm 
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={authLoading}
      />
    );
  }

  return (
    <div className="messenger">
      <Sidebar 
        user={user}
        users={users}
        selectedUser={selectedUser}
        onSelectUser={handleSelectUser}
        isConnecting={isConnecting}
        onToggleTheme={toggleTheme}
        isDarkTheme={isDarkTheme}
        onLogout={logout}
      />
      
      <ChatArea 
        selectedUser={selectedUser}
        messages={messages}
        currentUserId={user?.id}
        typing={false}
        replyTo={replyTo}
        onReply={setReplyTo}
        onForward={handleForwardMessage}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onReaction={handleAddReaction}
        onSendMessage={handleSendMessage}
        onFileSend={handleFileSend}
        onTyping={handleTyping}
        onSetReplyTo={setReplyTo}
        isConnecting={isConnecting}
        onBack={handleBack}
        isMobileOpen={isMobileChatOpen}
        loading={messagesLoading}
      />
    </div>
  );
}

export default App;