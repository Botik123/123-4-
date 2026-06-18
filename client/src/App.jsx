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
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const isConnectingRef = useRef(false);

  const { user, loading: authLoading, login, register, logout } = useAuth();
  
  const { 
    users, 
    loading: usersLoading, 
    fetchUsers,
    addUser,
    updateUserStatus,
    setUsers
  } = useUsers();
  
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
    markAsRead
  } = useMessages(user?.id, selectedUser?.id);
  
  // 🔥 БЕЗ КОМНАТ
  const {
    isConnecting,
    sendTyping,
    connect,
    disconnect
  } = useWebSocket({
    onMessage: (data) => {
      addMessage(data);
      if (selectedUser && data.from === selectedUser.id) {
        playMessageSound();
        markAsRead(data.from);
      }
    },
    onMessageEdited: (data) => {
      updateMessage(data.messageId, { text: data.text, edited: true });
    },
    onMessageDeleted: (data) => {
      updateMessage(data.messageId, { text: '🗑️ Сообщение удалено', deleted: true });
    },
    onReaction: (data) => {
      const targetUserId = data.to || selectedUser?.id;
      if (targetUserId) {
        addReaction(data.messageId, data.reaction, targetUserId);
      }
    },
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
    onNewUser: (data) => {
      addUser(data.user);
    },
    onOnlineUsers: (onlineUserIds) => {
      const onlineSet = new Set(onlineUserIds);
      
      setUsers(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.map(u => ({
          ...u,
          online: onlineSet.has(u.id)
        }));
      });
      
      if (selectedUser) {
        setSelectedUser(prev => ({
          ...prev,
          online: onlineSet.has(prev.id)
        }));
      }
    }
  });

  // Подключаем WebSocket при авторизации
  useEffect(() => {
    if (user && !isConnectingRef.current) {
      isConnectingRef.current = true;
      connect(user.id);
      fetchUsers();
    }
    return () => {
      if (user) {
        isConnectingRef.current = false;
        disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 🔥 БЕЗ КОМНАТ — ТОЛЬКО ЗАГРУЗКА ИСТОРИИ
  useEffect(() => {
    if (selectedUser && user) {
      loadHistory(user.id, selectedUser.id);
      
      if (window.innerWidth <= 768) {
        setIsMobileChatOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // Дебаг режим
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
        setUsers: setUsers
      };
      console.log('✅ Дебаг режим активирован! Используй window.__debug');
    }
  }, [messages, users, selectedUser, setUsers]);

  // Обработчики
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    if (window.innerWidth <= 768) {
      setIsMobileChatOpen(true);
    }
  };

  const handleBack = () => {
    if (window.innerWidth <= 768) {
      setIsMobileChatOpen(false);
    }
  };

  const handleLogin = async (username, password) => {
    const result = await login(username, password);
    if (!result.success) {
      alert(result.error);
    }
  };

  const handleRegister = async (username, password) => {
    const result = await register(username, password);
    if (!result.success) {
      alert(result.error);
    }
  };

  const handleSendMessage = (text) => {
    if (!selectedUser) return;
    sendMessage(selectedUser.id, text, replyTo?.id);
    playSendSound();
    setReplyTo(null);
  };

  const handleFileSend = (fileText) => {
    if (!selectedUser) return;
    sendMessage(selectedUser.id, fileText);
    playSendSound();
  };

  const handleForwardMessage = (message) => {
    if (!selectedUser) return;
    forwardMessage(selectedUser.id, message.id);
  };

  const handleEditMessage = (message) => {
    if (!selectedUser) return;
    const newText = prompt('Редактировать сообщение:', message.text);
    if (newText && newText.trim()) {
      editMessage(message.id, newText.trim(), selectedUser.id);
    }
  };

  const handleDeleteMessage = (messageId) => {
    if (!selectedUser) return;
    if (window.confirm('Удалить сообщение?')) {
      deleteMessage(messageId, selectedUser.id);
    }
  };

  const handleAddReaction = (messageId, reaction) => {
    if (!selectedUser) return;
    addReaction(messageId, reaction, selectedUser.id);
  };

  const handleTyping = (isTyping) => {
    if (!selectedUser) return;
    if (isTyping) {
      sendTyping(selectedUser.id);
    } else {
      sendTyping(selectedUser.id);
    }
  };

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