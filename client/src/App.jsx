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
  const [typingUser, setTypingUser] = useState(null);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  
  const API_URL = 'http://localhost:3001';
  const WS_URL = 'ws://localhost:3001';
  
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
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
      if (data.error) {
        alert(data.error);
      } else {
        alert('Успешная регистрация! Теперь войдите.');
        setIsLogin(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Логин
  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else {
        setUser(data);
        localStorage.setItem('chat_user', JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Выход из аккаунта
  const handleLogout = () => {
    if (ws) ws.close();
    setUser(null);
    setSelectedUser(null);
    setMessages([]);
    localStorage.removeItem('chat_user');
  };

  // Авторизация по сохраненной сессии
  useEffect(() => {
    const saved = localStorage.getItem('chat_user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  // Загрузка списка пользователей
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/users/${user.id}`);
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Загрузка истории сообщений
  useEffect(() => {
    if (!user || !selectedUser) return;
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/messages/${user.id}/${selectedUser.id}`);
        const data = await res.json();
        setMessages(data);
        scrollToBottom();
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, [selectedUser, user]);

  // Инициализация WebSocket со всеми типами событий бэкенда
  useEffect(() => {
    if (!user) return;
    const socket = new WebSocket(WS_URL);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', userId: user.id }));
    };
    
    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      
      switch (parsed.type) {
        case 'message':
          // Проверяем, относится ли сообщение к текущему открытому чату
          if (
            (parsed.from === user.id && parsed.to === selectedUser?.id) ||
            (parsed.from === selectedUser?.id && parsed.to === user.id)
          ) {
            setMessages(prev => {
              // Исключаем дубли по id
              if (prev.some(m => m.id === parsed.id)) return prev;
              return [...prev, parsed];
            });
            // Отправляем статус "прочитано", если сообщение пришло от собеседника
            if (parsed.from === selectedUser?.id) {
              socket.send(JSON.stringify({ type: 'read', from: parsed.from, to: user.id }));
            }
          }
          break;

        case 'message_edited':
          setMessages(prev => prev.map(m => 
            m.id === parsed.messageId ? { ...m, text: parsed.text, edited: 1, edited_at: parsed.edited_at } : m
          ));
          break;

        case 'message_deleted':
          setMessages(prev => prev.map(m => 
            m.id === parsed.messageId ? { ...m, text: "🗑️ Сообщение удалено", deleted: 1 } : m
          ));
          break;

        case 'reaction':
          // Так как структуры реакций могут расширяться, перезаписываем или обновляем в UI
          setMessages(prev => prev.map(m => {
            if (m.id === parsed.messageId) {
              // Кастомное поле для быстрого отображения реакции в текущем сеансе
              return { ...m, current_reaction: parsed.reaction };
            }
            return m;
          }));
          break;
          
        case 'message_read':
          if (selectedUser && parsed.from === selectedUser.id) {
            setMessages(prev => prev.map(m => m.from_user === user.id ? { ...m, read: 1 } : m));
          }
          break;
          
        case 'typing':
          if (selectedUser && parsed.from === selectedUser.id) {
            setTypingUser(parsed.from);
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
          }
          break;

        case 'status':
          setUsers(prev => prev.map(u => 
            u.id === parsed.userId ? { ...u, online: parsed.online ? 1 : 0, last_seen: parsed.last_seen } : u
          ));
          break;
          
        default:
          break;
      }
    };
    
    setWs(socket);
    return () => socket.close();
  }, [user, selectedUser]);

  // Отправка текстового сообщения
  const sendMessage = () => {
    if (!inputText.trim() || !ws || !selectedUser) return;
    
    const payload = {
      type: 'message',
      from: user.id,
      to: selectedUser.id,
      text: inputText,
      reply_to: replyTo ? replyTo.id : null
    };
    
    ws.send(JSON.stringify(payload));
    setInputText('');
    setReplyTo(null);
  };

  // Отправка файлов через REST-эндпоинт /upload
  const sendFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.url && ws) {
        // Формируем сообщение, где текстом будет ссылка или метаданные
        const payload = {
          type: 'message',
          from: user.id,
          to: selectedUser.id,
          text: data.url, 
          file_type: data.type,
          thumbnail: data.thumbnail
        };
        ws.send(JSON.stringify(payload));
      }
    } catch (err) {
      console.error('Ошибка отправки файла:', err);
    }
  };

  // Отправка статуса набора текста
  const handleTyping = () => {
    if (!ws || !selectedUser || typing) return;
    setTyping(true);
    ws.send(JSON.stringify({ type: 'typing', from: user.id, to: selectedUser.id }));
    setTimeout(() => setTyping(false), 2000);
  };

  // Отправка реакции
  const sendReaction = (messageId, reaction) => {
    if (!ws || !selectedUser) return;
    ws.send(JSON.stringify({
      type: 'reaction',
      messageId,
      userId: user.id,
      reaction,
      to: selectedUser.id
    }));
    setShowReactions(null);
  };

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>{isLogin ? 'Вход в мессенджер' : 'Регистрация'}</h2>
          <input
            type="text"
            placeholder="Имя пользователя"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />
          {isLogin ? (
            <button onClick={handleLogin}>Войти</button>
          ) : (
            <button onClick={handleRegister}>Создать аккаунт</button>
          )}
          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="messenger-container">
      {/* Боковая панель */}
      <div className="sidebar">
        <div className="profile-header">
          <div className="user-info">
            <div className="avatar">👤</div>
            <h3>{user.username}</h3>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Выйти</button>
        </div>
        <div className="users-list">
          {users.map((u) => (
            <div
              key={u.id}
              className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="avatar">👤</div>
              <div className="user-details">
                <span className="username">{u.username}</span>
                <span className={`status ${u.online ? 'online' : 'offline'}`}>
                  {u.online ? 'онлайн' : 'офлайн'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Окно чата */}
      <div className="chat-window">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h3>{selectedUser.username}</h3>
              {typingUser === selectedUser.id && (
                <span className="typing-indicator">печатает...</span>
              )}
            </div>
            
            <div className="messages-area">
              {messages.map((msg) => {
                const isMyMessage = msg.from_user === user.id || msg.from === user.id;
                const textContent = msg.text || '';
                const isFile = textContent.startsWith('/uploads/');
                
                return (
                  <div key={msg.id} className={`message-wrapper ${isMyMessage ? 'outgoing' : 'incoming'}`}>
                    <div className="message-box">
                      {msg.reply_to && (
                        <div className="reply-preview">
                          <small>Ответ на сообщение</small>
                        </div>
                      )}
                      
                      <div className="message-text">
                        {isFile ? (
                          textContent.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                            <img 
                              src={`${API_URL}${msg.thumbnail || textContent}`} 
                              alt="Uploaded content" 
                              className="chat-image" 
                            />
                          ) : (
                            <a href={`${API_URL}${textContent}`} target="_blank" rel="noreferrer" className="file-link">
                              📎 Скачать файл
                            </a>
                          )
                        ) : (
                          textContent
                        )}
                      </div>
                      
                      {/* Блок отображения реакций */}
                      {(msg.current_reaction || msg.reaction) && (
                        <div className="message-reaction-badge">
                          {msg.current_reaction || msg.reaction}
                        </div>
                      )}

                      <div className="message-meta">
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {isMyMessage && (
                          <span className="read-status">{msg.read ? '✓✓' : '✓'}</span>
                        )}
                      </div>
                      
                      {/* Кнопка вызова панели реакций и ответа */}
                      <div className="message-actions-trigger">
                        <button onClick={() => setReplyTo(msg)}>↩️</button>
                        <button onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}>😀</button>
                        
                        {showReactions === msg.id && (
                          <div className="reactions-picker">
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                              <button key={emoji} onClick={() => sendReaction(msg.id, emoji)}>{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            
            {replyTo && (
              <div className="reply-bar">
                <span>Ответ на: {replyTo.text?.substring(0, 50)}...</span>
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
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
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
          <div className="no-chat">Выберите контакт из списка слева, чтобы начать общение</div>
        )}
      </div>
    </div>
  );
}

export default App;