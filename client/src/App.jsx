import React, { useState, useEffect } from 'react';
import './App.css';
import AuthForm from './components/Auth/AuthForm';
import Sidebar from './components/Sidebar/Sidebar';
import ChatArea from './components/Chat/ChatArea';
import { useAuth } from './components/Hooks/useAuth';
import { useWebSocket } from './components/Hooks/useWebSocket';
import { useMessages } from './components/Hooks/useMessages';
import { useUsers } from './components/Hooks/useUsers';

function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

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
    addReaction,
    addMessage,
    updateMessage,
    removeMessage,
    loadHistory
  } = useMessages(user?.id, selectedUser?.id);
  const {
    isConnecting,
    sendTyping,
    connect,
    disconnect
  } = useWebSocket({
    onMessage: (data) => {
      addMessage(data);
    },
    onMessageEdited: (data) => {
      updateMessage(data.messageId, { text: data.text, edited: true });
    },
    onMessageDeleted: (data) => {
      updateMessage(data.messageId, { text: '🗑️ Сообщение удалено', deleted: true });
    },
    onReaction: (data) => {
      addReaction(data.messageId, data.userId, data.reaction);
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
    if (user) {
      connect(user.id);
      fetchUsers();
    }
    return () => {
      if (user) disconnect();
    };
  }, [user]);

  // Загружаем историю при выборе пользователя
  useEffect(() => {
    if (user && selectedUser) {
      loadHistory(user.id, selectedUser.id);
    }
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
    setReplyTo(null);
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
        onForward={() => {}}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReaction={addReaction}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onSetReplyTo={setReplyTo}
        isConnecting={isConnecting}
      />
    </div>
  );
}

export default App;