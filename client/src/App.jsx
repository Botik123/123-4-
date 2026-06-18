/**
 * @file client/src/App.jsx
 * @description Главный компонент приложения мессенджера
 * Интеграция всех hooks и компонентов, управление состоянием
 */

import React, { useState, useEffect, useRef } from 'react';
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
    updateUserStatus
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
    markAsRead
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
    // Новое сообщение получено
    onMessage: (data) => {
      addMessage(data);
      if (selectedUser && data.from === selectedUser.id) {
        playMessageSound();
        markAsRead(data.from);
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
    // Реакция на сообщение (получена от другого пользователя)
    onReaction: (data) => {
      // data: { messageId, userId, reaction, to }
      // Обновляем реакцию в текущем чате
      if (selectedUser) {
        addReaction(data.messageId, data.reaction, selectedUser.id);
      }
    },
    // Изменение статуса пользователя (онлайн/оффлайн)
    onStatus: (data) => {
      updateUserStatus(data.userId, data.online, data.last_seen);
      if (selectedUser && selectedUser.id === data.userId) {
        setSelectedUser(prev => ({
          ...prev,
          online: data.online,
          last_seen: data.last_seen
        }));
      }
    },
    // Новый пользователь зарегистрировался
    onNewUser: (data) => {
      // Не добавляем текущего пользователя
      if (data.user?.id !== user?.id) {
        addUser(data.user);
      }
    },
    // Список онлайн пользователей
    onOnlineUsers: (onlineUserIds) => {
      const onlineSet = new Set(onlineUserIds);
      
      // Обновляем статусы всех пользователей кроме текущего
      users.forEach(u => {
        if (u.id !== user?.id) {
          updateUserStatus(u.id, onlineSet.has(u.id), onlineSet.has(u.id) ? Date.now() : u.last_seen);
        }
      });
      
      if (selectedUser) {
        setSelectedUser(prev => ({
          ...prev,
          online: prev ? onlineSet.has(prev.id) : false
        }));
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
      connect(user.id);
      fetchUsers(user.id);
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