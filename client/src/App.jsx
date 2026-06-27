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
import ForwardModal from './components/Chat/ForwardModal';
import ForwardModalCSS from './components/Chat/ForwardModal.css?inline';
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

  // Состояние для модалки пересылки
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);

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
  
  // Хранилище статусов (применяются после загрузки users)
  const pendingStatuses = useRef(new Map());
  // Хранилище онлайн ID из onOnlineUsers
  const onlineUserIds = useRef(new Set());
  
  // === MESSAGES HOOK ===
  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    forwardMessageToMultiple,
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
      
      // Сохраняем в onlineUserIds
      if (data.online) {
        onlineUserIds.current.add(data.userId);
      } else {
        onlineUserIds.current.delete(data.userId);
      }
      console.log(`  📝 onlineUserIds: ${Array.from(onlineUserIds.current)}`);
      
      // Применяем если users загружен
      if (users && users.length > 0) {
        applyOnlineStatuses(users);
      }
      
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
    onOnlineUsers: (onlineUserIdsList) => {
      console.log(`📡 onOnlineUsers:`, onlineUserIdsList, `users.length=${users.length}`);
      
      // Сохраняем онлайн ID
      onlineUserIds.current = new Set(onlineUserIdsList);
      console.log(`  📝 Сохранено ${onlineUserIdsList.length} онлайн ID:`, Array.from(onlineUserIds.current));
      
      // Применяем если users уже загружен
      if (users && users.length > 0) {
        console.log(`  🚀 Применяем статусы сразу`);
        applyOnlineStatuses(users);
      } else {
        console.log(`  ⏳ users ещё не загружен, ждём useEffect`);
      }
      
      // Обновляем selectedUser
      if (selectedUser) {
        setSelectedUser(prev => prev ? {
          ...prev,
          online: onlineUserIds.current.has(prev.id),
          last_seen: onlineUserIds.current.has(prev.id) ? Date.now() : prev.last_seen
        } : null);
      }
    }
  });

  // Применить онлайн статусы
  const applyOnlineStatuses = useCallback((usersList) => {
    if (!usersList || usersList.length === 0) {
      console.warn('⚠️ applyOnlineStatuses: usersList пустой');
      return;
    }
    
    console.log(`🔄 applyOnlineStatuses:`, {
      onlineCount: onlineUserIds.current.size,
      onlineIds: Array.from(onlineUserIds.current),
      usersCount: usersList.length,
      users: usersList.map(u => ({ id: u.id, username: u.username, online: u.online }))
    });
    
    setUsers(prev => {
      if (!prev || prev.length === 0) {
        console.warn('⚠️ applyOnlineStatuses: prev пустой');
        return prev;
      }
      
      let changed = 0;
      const updated = prev.map(u => {
        const isOnline = onlineUserIds.current.has(u.id);
        // Не обновляем текущего пользователя
        if (u.id === user?.id) return u;
        
        if (u.online !== isOnline) {
          changed++;
          console.log(`  📍 ${u.username} (${u.id}): ${u.online} -> ${isOnline}`);
          return {
            ...u,
            online: isOnline,
            last_seen: isOnline ? Date.now() : u.last_seen
          };
        }
        return u;
      });
      
      if (changed === 0) {
        console.log('  ℹ️ Нет изменений статусов');
      } else {
        console.log(`  ✅ Изменено ${changed} статусов`);
      }
      return updated;
    });
  }, [user?.id]);

  // ==========================================
  // === EFFECTS: ЖИЗНЕННЫЙ ЦИКЛ ===
  // ==========================================
  
  // Подключаем WebSocket при авторизации пользователя
  useEffect(() => {
    if (user && !isConnectingRef.current) {
      console.log(`🔌 Подключение WebSocket: ${user.id}`);
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

  // Загружаем пользователей при успешной регистрации
  useEffect(() => {
    if (user && users.length === 0) {
      const timer = setTimeout(() => {
        fetchUsers(user.id);
      }, 200); // Небольшая задержка чтобы broadcastNewUser успел сработать
      return () => clearTimeout(timer);
    }
  }, [user?.id, users.length]); // Зависимость от users.length чтобы сработать после регистрации

  // Применяем статусы после загрузки users
  useEffect(() => {
    console.log(`🔄 useEffect users: length=${users?.length || 0}, onlineIds.size=${onlineUserIds.current.size}`);
    
    if (users && users.length > 0 && onlineUserIds.current.size > 0) {
      console.log(`  🚀 ВЫЗЫВАЕМ applyOnlineStatuses`);
      applyOnlineStatuses(users);
    } else if (!users || users.length === 0) {
      console.log(`  ⏳ users ещё не загружен`);
    } else {
      console.log(`  ⏳ onlineUserIds пуст, ждём onOnlineUsers`);
    }
  }, [users, applyOnlineStatuses]);

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

  // Открыть модалку пересылки
  const handleOpenForwardModal = (message) => {
    setMessageToForward(message);
    setForwardModalOpen(true);
  };

  // Переслать сообщение нескольким получателям
  const handleForwardToMultiple = async (message, recipientIds) => {
    if (!message || !recipientIds || recipientIds.length === 0) return;
    
    console.log(`📎 handleForwardToMultiple: message=${message.id}, recipients=${JSON.stringify(recipientIds)}`);
    
    try {
      const results = await forwardMessageToMultiple(recipientIds, message.id);
      console.log(`✅ handleForwardToMultiple: results=`, results);
      alert(`✅ Сообщение переслано ${recipientIds.length} получателям`);
    } catch (error) {
      console.error('❌ Ошибка пересылки:', error);
      alert(`❌ Ошибка пересылки: ${error.message || 'Неизвестная ошибка'}`);
    }
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
        onForward={handleOpenForwardModal}
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
      
      {/* Модалка пересылки */}
      <ForwardModal
        isOpen={forwardModalOpen}
        onClose={() => {
          setForwardModalOpen(false);
          setMessageToForward(null);
        }}
        message={messageToForward}
        users={users}
        currentUserId={user?.id}
        onForward={handleForwardToMultiple}
      />
    </div>
  );
}

export default App;