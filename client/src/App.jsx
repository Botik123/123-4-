import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [ws, setWs] = useState(null);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showReactions, setShowReactions] = useState(null);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  
  const API_URL = 'http://localhost:3001';
  const WS_URL = 'ws://localhost:3001';
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Регистрация
  const handleRegister = async () => {
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (response.ok) {
        alert('Регистрация успешна! Теперь войдите.');
        setIsLogin(true);
        setLoginUsername('');
        setLoginPassword('');
      } else {
        alert(data.error || 'Ошибка регистрации');
      }
    } catch (error) {
      alert('Ошибка подключения к серверу');
    }
  };
  
  // Вход
  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
      } else {
        alert(data.error || 'Ошибка входа');
      }
    } catch (error) {
      alert('Ошибка подключения к серверу');
    }
  };
  
  // WebSocket подключение
  useEffect(() => {
    if (user) {
      const socket = new WebSocket(WS_URL);
      
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', userId: user.id }));
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            if (selectedUser && data.from === selectedUser.id) {
              setMessages(prev => [...prev, {
                id: data.id,
                from_user: data.from,
                to_user: data.to,
                text: data.text,
                timestamp: data.timestamp,
                read: data.read,
                reply_to: data.reply_to,
                forwarded_from: data.forwarded_from
              }]);
              socket.send(JSON.stringify({ type: 'read', from: data.from, to: user.id }));
            }
            break;
            
          case 'message_edited':
            setMessages(prev => prev.map(msg => 
              msg.id === data.messageId ? { ...msg, text: data.text, edited: true } : msg
            ));
            break;
            
          case 'message_deleted':
            setMessages(prev => prev.map(msg => 
              msg.id === data.messageId ? { ...msg, text: '🗑️ Сообщение удалено', deleted: true } : msg
            ));
            break;
            
          case 'reaction':
            setMessages(prev => prev.map(msg => {
              if (msg.id === data.messageId) {
                const reactions = msg.reactions || {};
                reactions[data.userId] = data.reaction;
                return { ...msg, reactions };
              }
              return msg;
            }));
            break;
            
          case 'message_sent':
            setMessages(prev => prev.map(msg => 
              msg.id === null ? { ...msg, id: data.id, timestamp: data.timestamp } : msg
            ));
            break;
            
          case 'message_read':
            setMessages(prev => prev.map(msg => 
              msg.from_user === user.id && msg.to_user === data.from ? { ...msg, read: 1 } : msg
            ));
            break;
            
          case 'typing':
            if (selectedUser && data.from === selectedUser.id) {
              setTyping(true);
              setTimeout(() => setTyping(false), 2000);
            }
            break;
            
          case 'status':
            setUsers(prev => prev.map(u => 
              u.id === data.userId ? { ...u, online: data.online, last_seen: data.last_seen } : u
            ));
            break;
            
          default:
            break;
        }
      };
      
      setWs(socket);
      return () => socket.close();
    }
  }, [user, selectedUser]);
  
  // Загрузка пользователей
  useEffect(() => {
    if (user) {
      fetch(`${API_URL}/users/${user.id}`)
        .then(res => res.json())
        .then(data => setUsers(data));
    }
  }, [user]);
  
  // Загрузка сообщений
  useEffect(() => {
    if (user && selectedUser) {
      fetch(`${API_URL}/messages/${user.id}/${selectedUser.id}`)
        .then(res => res.json())
        .then(data => setMessages(data));
    }
  }, [user, selectedUser]);
  
  // Отправка сообщения
  const sendMessage = () => {
    if (!inputText.trim() || !selectedUser || !ws) return;
    
    const tempId = Date.now();
    let textToSend = inputText;
    
    if (replyTo) {
      textToSend = `↩️ Ответ: "${replyTo.text.substring(0, 50)}"\n${inputText}`;
    }
    
    setMessages(prev => [...prev, {
      id: tempId,
      from_user: user.id,
      to_user: selectedUser.id,
      text: textToSend,
      timestamp: Date.now(),
      read: 0,
      reply_to: replyTo?.id
    }]);
    
    ws.send(JSON.stringify({
      type: 'message',
      from: user.id,
      to: selectedUser.id,
      text: textToSend,
      reply_to: replyTo?.id
    }));
    
    setInputText('');
    setReplyTo(null);
  };
  
  // ✏️ Редактирование
  const handleEdit = (message) => {
    const newText = prompt('Редактировать сообщение:', message.text);
    if (newText && newText.trim() && ws) {
      ws.send(JSON.stringify({
        type: 'edit_message',
        messageId: message.id,
        to: selectedUser.id,
        text: newText
      }));
    }
  };
  
  // 🗑️ Удаление
  const handleDelete = (messageId) => {
    if (window.confirm('Удалить сообщение?')) {
      ws.send(JSON.stringify({
        type: 'delete_message',
        messageId: messageId,
        to: selectedUser.id
      }));
    }
  };
  
  // 😊 Реакция
  const addReaction = (messageId, reaction) => {
    if (!ws || !selectedUser) return;
    
    ws.send(JSON.stringify({
      type: 'reaction',
      messageId: messageId,
      userId: user.id,
      to: selectedUser.id,
      reaction: reaction
    }));
    
    setShowReactions(null);
  };
  
  // 📎 Пересылка
  const forwardMessage = (message) => {
    if (!ws || !selectedUser) return;
    
    const forwardText = `📎 Переслано: ${message.text}`;
    
    ws.send(JSON.stringify({
      type: 'message',
      from: user.id,
      to: selectedUser.id,
      text: forwardText,
      forwarded_from: message.from_user
    }));
  };
  
  // 📁 Отправка файла
  const sendFile = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedUser || !ws) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const fileData = await response.json();
      
      let fileText = '';
      if (fileData.type === 'image') {
        fileText = `📷 Изображение: ${API_URL}${fileData.url}`;
      } else if (fileData.type === 'audio') {
        fileText = `🎵 Аудио: ${fileData.name}`;
      } else if (fileData.type === 'video') {
        fileText = `🎬 Видео: ${fileData.name}`;
      } else {
        fileText = `📎 Файл: ${fileData.name}`;
      }
      
      ws.send(JSON.stringify({
        type: 'message',
        from: user.id,
        to: selectedUser.id,
        text: fileText
      }));
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        from_user: user.id,
        to_user: selectedUser.id,
        text: fileText,
        timestamp: Date.now(),
        read: 0
      }]);
      
    } catch (error) {
      alert('Ошибка загрузки файла');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleTyping = () => {
    if (ws && selectedUser) {
      ws.send(JSON.stringify({ type: 'typing', from: user.id, to: selectedUser.id }));
    }
  };
  
  const reactionsList = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  
  // Форма входа
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>{isLogin ? 'Вход' : 'Регистрация'}</h2>
          <input
            type="text"
            placeholder="Имя пользователя"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (isLogin ? handleLogin() : handleRegister())}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (isLogin ? handleLogin() : handleRegister())}
          />
          <button onClick={isLogin ? handleLogin : handleRegister}>
            {isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </p>
        </div>
      </div>
    );
  }
  
  // Основной интерфейс
  return (
    <div className="messenger">
      <div className="sidebar">
        <div className="user-info">
          <div className="avatar">{user.username?.[0]?.toUpperCase() || 'U'}</div>
          <div className="username">{user.username}</div>
        </div>
        <div className="users-list">
          <h3>Контакты</h3>
          {users.map(u => (
            <div
              key={u.id}
              className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="avatar small">{u.username?.[0]?.toUpperCase() || 'U'}</div>
              <div className="user-details">
                <div className="username">{u.username}</div>
                <div className="status">{u.online ? '🟢 Онлайн' : '⚫ Оффлайн'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="avatar">{selectedUser.username?.[0]?.toUpperCase() || 'U'}</div>
              <div>
                <div className="username">{selectedUser.username}</div>
                <div className="status">{typing ? '✍️ Печатает...' : (selectedUser.online ? '🟢 Онлайн' : 'Не в сети')}</div>
              </div>
            </div>
            
            <div className="messages-container">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`message ${msg.from_user === user.id ? 'sent' : 'received'} ${msg.deleted ? 'deleted' : ''}`}
                >
                  <div className="message-actions">
                    <button onClick={() => setReplyTo(msg)} title="Ответить">↩️</button>
                    <button onClick={() => forwardMessage(msg)} title="Переслать">📎</button>
                    {msg.from_user === user.id && (
                      <button onClick={() => handleEdit(msg)} title="Редактировать">✏️</button>
                    )}
                    <button onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)} title="Реакции">😊</button>
                    {msg.from_user === user.id && (
                      <button onClick={() => handleDelete(msg.id)} title="Удалить">🗑️</button>
                    )}
                  </div>
                  
                  {showReactions === msg.id && (
                    <div className="reactions-picker">
                      {reactionsList.map(r => (
                        <button key={r} onClick={() => addReaction(msg.id, r)}>{r}</button>
                      ))}
                    </div>
                  )}
                  
                  <div className="message-content">
                    {msg.reply_to && (
                      <div className="reply-preview">
                        <div className="reply-indicator">↩️ Ответ</div>
                      </div>
                    )}
                    {msg.forwarded_from && (
                      <div className="forward-indicator">📎 Переслано</div>
                    )}
                    <div className="message-text">
                      {msg.text}
                      {msg.edited && <span className="edited-indicator"> (ред.)</span>}
                    </div>
                    <div className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                      {msg.from_user === user.id && (
                        <span className="read-status">{msg.read ? '✓✓' : '✓'}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {replyTo && (
              <div className="reply-bar">
                <span>Ответ: {replyTo.text.substring(0, 50)}...</span>
                <button onClick={() => setReplyTo(null)}>✖️</button>
              </div>
            )}
            
            <div className="input-area">
              <input
                ref={inputRef}
                type="text"
                placeholder="Введите сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                onKeyUp={handleTyping}
              />
              <label className="file-button">
                📎
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={sendFile}
                  style={{ display: 'none' }}
                />
              </label>
              <button onClick={sendMessage}>📤</button>
            </div>
          </>
        ) : (
          <div className="no-chat">Выберите контакт</div>
        )}
      </div>
    </div>
  );
}

export default App;