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

function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const isConnectingRef = useRef(false);

  const { user, loading: authLoading, login, register, logout } = useAuth();
  const { 
    users, 
    loading: usersLoading, 
    fetchUsers,
    addUser,
    updateUserStatus 
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
    },
    onNewUser: (data) => {
      addUser(data.user);
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

  // Загружаем историю при выборе пользователя
  useEffect(() => {
    if (user && selectedUser) {
      loadHistory(user.id, selectedUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // Обработчики
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

  // Обработка отправки файла
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

  const handleTyping = () => {
    if (selectedUser) {
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
        onSelectUser={setSelectedUser}
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
      />
    </div>
  );
}

export default App;