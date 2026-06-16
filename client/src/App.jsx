import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Цвета для аватаров
const avatarColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#FF8A5C', '#A29BFE', '#FD79A8', '#00CEC9',
  '#FDCB6E', '#E17055', '#00B894', '#6C5CE7', '#FD79A8'
];

const getAvatarColor = (name) => {
  if (!name) return '#667eea';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const API_URL = 'http://localhost:3001';
  const WS_URL = 'ws://localhost:3001';

  // Набор эмодзи
  const emojiList = ['😊', '😂', '❤️', '🔥', '👍', '👏', '🎉', '✨', '💪', '🤔', '😅', '🥰', '😍', '🤩', '😎', '🙏', '💀', '👀', '🤝', '💯'];

  // Переключение темы
  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
    document.documentElement.setAttribute('data-theme', !isDarkTheme ? 'dark' : 'light');
  };

  // Вставка эмодзи
  const insertEmoji = (emoji) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Функция для экранирования HTML (XSS защита)
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Парсинг файлового сообщения
  const parseFileMessage = (text) => {
    if (!text) return null;
    
    if (text === '🗑️ Сообщение удалено') {
      return { type: 'deleted' };
    }
    
    const imageMatch = text.match(/📷 Изображение: (http:\/\/localhost:3001\/uploads\/[^\s]+)/);
    if (imageMatch) {
      return { type: 'image', url: imageMatch[1] };
    }
    
    const audioMatch = text.match(/🎵 Аудио: ([^\s]+(?:\s[^\s]+)*?)\s*(?:http:\/\/localhost:3001\/uploads\/[^\s]+)?$/);
    if (audioMatch) {
      const urlMatch = text.match(/http:\/\/localhost:3001\/uploads\/[^\s]+/);
      if (urlMatch) {
        return { type: 'audio', name: audioMatch[1].trim(), url: urlMatch[0] };
      }
      return { type: 'audio', name: audioMatch[1].trim(), url: null };
    }
    
    const videoMatch = text.match(/🎬 Видео: ([^\s]+(?:\s[^\s]+)*?)\s*(?:http:\/\/localhost:3001\/uploads\/[^\s]+)?$/);
    if (videoMatch) {
      const urlMatch = text.match(/http:\/\/localhost:3001\/uploads\/[^\s]+/);
      if (urlMatch) {
        return { type: 'video', name: videoMatch[1].trim(), url: urlMatch[0] };
      }
      return { type: 'video', name: videoMatch[1].trim(), url: null };
    }
    
    const fileMatch = text.match(/📎 Файл: ([^\s]+(?:\s[^\s]+)*?)\s*(?:http:\/\/localhost:3001\/uploads\/[^\s]+)?$/);
    if (fileMatch) {
      const urlMatch = text.match(/http:\/\/localhost:3001\/uploads\/[^\s]+/);
      if (urlMatch) {
        return { type: 'file', name: fileMatch[1].trim(), url: urlMatch[0] };
      }
      return { type: 'file', name: fileMatch[1].trim(), url: null };
    }
    
    return null;
  };

  // Рендер файлового сообщения
  const renderFileMessage = (fileData, isOwn) => {
    if (!fileData) return null;

    switch (fileData.type) {
      case 'deleted':
        return <span className="deleted-message">🗑️ Сообщение удалено</span>;

      case 'image':
        return (
          <div className="media-message image-message">
            <img 
              src={fileData.url} 
              alt="Изображение"
              onClick={() => window.open(fileData.url, '_blank')}
              loading="lazy"
            />
          </div>
        );

      case 'audio':
        if (fileData.url) {
          return (
            <div className="media-message audio-message">
              <div className="audio-player">
                <audio controls>
                  <source src={fileData.url} type="audio/mpeg" />
                  Ваш браузер не поддерживает аудио
                </audio>
                <div className="audio-name">{fileData.name}</div>
              </div>
            </div>
          );
        }
        return <div className="media-message file-message">🎵 {fileData.name}</div>;

      case 'video':
        if (fileData.url) {
          return (
            <div className="media-message video-message">
              <video controls>
                <source src={fileData.url} type="video/mp4" />
                Ваш браузер не поддерживает видео
              </video>
              <div className="video-name">{fileData.name}</div>
            </div>
          );
        }
        return <div className="media-message file-message">🎬 {fileData.name}</div>;

      case 'file':
        if (fileData.url) {
          return (
            <div className="media-message file-message">
              <a href={fileData.url} download target="_blank" rel="noopener noreferrer">
                <div className="file-card">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{fileData.name}</span>
                  <span className="file-download">⬇️</span>
                </div>
              </a>
            </div>
          );
        }
        return <div className="media-message file-message">📎 {fileData.name}</div>;

      default:
        return null;
    }
  };

  // Функция для получения текста сообщения без префикса ответа
  const getCleanText = (text) => {
    if (!text) return '';
    const replyMatch = text.match(/^↩️ Ответ: "[^"]*"\n/);
    if (replyMatch) {
      return text.substring(replyMatch[0].length);
    }
    return text;
  };

  // Функция для получения текста ответа из сообщения
  const getReplyPreview = (text) => {
    if (!text) return null;
    const replyMatch = text.match(/^↩️ Ответ: "([^"]*)"\n/);
    if (replyMatch) {
      return replyMatch[1];
    }
    return null;
  };

  // Функция для получения красивого превью сообщения для ответа
  const getMessagePreview = (msg) => {
    if (!msg) return '';
    
    if (msg.deleted || msg.text === '🗑️ Сообщение удалено') {
      return '🗑️ Сообщение удалено';
    }
    
    const fileData = parseFileMessage(msg.text);
    if (fileData) {
      switch (fileData.type) {
        case 'image': return '📷 Изображение';
        case 'audio': return `🎵 ${fileData.name ? fileData.name.substring(0, 25) + '...' : 'Аудио'}`;
        case 'video': return `🎬 ${fileData.name ? fileData.name.substring(0, 25) + '...' : 'Видео'}`;
        case 'file': return `📎 ${fileData.name ? fileData.name.substring(0, 25) + '...' : 'Файл'}`;
        default: return '📎 Файл';
      }
    }
    
    const cleanText = getCleanText(msg.text);
    return cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
  };

  // Рендер содержимого сообщения
  const renderMessageContent = (msg, isOwn) => {
    const isDeleted = msg.deleted || msg.text === '🗑️ Сообщение удалено';
    if (isDeleted) {
      return <span className="deleted-message">🗑️ Сообщение удалено</span>;
    }

    const fileData = parseFileMessage(msg.text);
    if (fileData && fileData.type !== 'deleted') {
      return renderFileMessage(fileData, isOwn);
    }

    const replyPreview = getReplyPreview(msg.text);
    const cleanText = getCleanText(msg.text);

    return (
      <>
        {replyPreview && (
          <div className="reply-preview-inline">
            <div className="reply-preview-label">↩️ Ответ</div>
            <div className="reply-preview-text">{replyPreview}</div>
          </div>
        )}
        <div className="message-text-content" dangerouslySetInnerHTML={{ __html: escapeHtml(cleanText || msg.text || '') }} />
      </>
    );
  };

  // Группировка сообщений по дате
  const groupMessagesByDate = (messagesList) => {
    const groups = [];
    let currentDate = null;
    let currentGroup = [];

    messagesList.forEach(msg => {
      const msgDate = new Date(msg.timestamp).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Регистрация
  const handleRegister = async () => {
    if (loginUsername.length < 3 || loginUsername.length > 20) {
      alert('Имя пользователя должно быть от 3 до 20 символов');
      return;
    }

    if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(loginUsername)) {
      alert('Имя пользователя содержит недопустимые символы');
      return;
    }

    if (loginPassword.length < 4) {
      alert('Пароль должен быть минимум 4 символа');
      return;
    }

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
      console.error('Register error:', error);
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
      console.error('Login error:', error);
      alert('Ошибка подключения к серверу');
    }
  };

  // WebSocket подключение
  useEffect(() => {
    if (user) {
      setIsConnecting(true);
      const socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnecting(false);
        socket.send(JSON.stringify({ type: 'auth', userId: user.id }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'message':
              if (selectedUser && data.from === selectedUser.id) {
                const newMsg = {
                  id: data.id,
                  from_user: data.from,
                  to_user: data.to,
                  text: data.text,
                  timestamp: data.timestamp,
                  read: data.read,
                  reply_to: data.reply_to,
                  forwarded_from: data.forwarded_from,
                  reactions: {}
                };
                setMessages(prev => [...prev, newMsg]);
                socket.send(JSON.stringify({ type: 'read', from: data.from, to: user.id }));
              }
              
              // Браузерное уведомление
              if (selectedUser?.id !== data.from) {
                if (Notification.permission === 'default') {
                  Notification.requestPermission();
                }
                if (Notification.permission === 'granted') {
                  const sender = users.find(u => u.id === data.from);
                  new Notification('💬 Новое сообщение', {
                    body: `${sender?.username || 'Пользователь'}: ${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}`,
                    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💬</text></svg>'
                  });
                }
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
              setMessages(prev => prev.map(msg => {
                if (msg.from_user === user.id && msg.to_user === data.from) {
                  return { ...msg, read: 1 };
                }
                return msg;
              }));
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

            case 'error':
              console.error('Server error:', data.message);
              alert(`Ошибка: ${data.message}`);
              break;

            default:
              break;
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnecting(false);
        
        // Автоматическое переподключение через 3 секунды (если не было ошибки авторизации)
        if (event.code !== 1000 && event.code !== 1001) {
          setTimeout(() => {
            if (user) {
              console.log('Attempting to reconnect...');
              setWs(null);
            }
          }, 3000);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
      };

      setWs(socket);
      return () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, 'Component unmount');
        }
        setWs(null);
      };
    }
  }, [user, selectedUser]);

  // Автоматическое переподключение
  useEffect(() => {
    if (!ws && user && !isConnecting) {
      const reconnectTimer = setTimeout(() => {
        console.log('Reconnecting...');
        setIsConnecting(true);
        const socket = new WebSocket(WS_URL);
        
        socket.onopen = () => {
          console.log('Reconnected successfully');
          setIsConnecting(false);
          socket.send(JSON.stringify({ type: 'auth', userId: user.id }));
          setWs(socket);
        };
        
        socket.onerror = () => {
          setIsConnecting(false);
        };
      }, 3000);
      
      return () => clearTimeout(reconnectTimer);
    }
  }, [ws, user, isConnecting]);

  // Загрузка пользователей
  useEffect(() => {
    if (user) {
      fetch(`${API_URL}/users/${user.id}`)
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(data => setUsers(data))
        .catch(err => {
          console.error('Error loading users:', err);
          setUsers([]);
        });
    }
  }, [user]);

  // Загрузка сообщений
  useEffect(() => {
    if (user && selectedUser) {
      fetch(`${API_URL}/messages/${user.id}/${selectedUser.id}`)
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(data => {
          const messagesWithReactions = data.map(msg => ({
            ...msg,
            reactions: msg.reactions || {}
          }));
          setMessages(messagesWithReactions);
        })
        .catch(err => {
          console.error('Error loading messages:', err);
          setMessages([]);
        });
    }
  }, [user, selectedUser]);

  // Отправка сообщения
  const sendMessage = () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !selectedUser || !ws || isConnecting) return;

    const tempId = Date.now();
    let textToSend = trimmedText;

    if (replyTo) {
      const preview = getMessagePreview(replyTo);
      textToSend = `↩️ Ответ: "${preview}"\n${trimmedText}`;
    }

    const newMsg = {
      id: tempId,
      from_user: user.id,
      to_user: selectedUser.id,
      text: textToSend,
      timestamp: Date.now(),
      read: 0,
      reply_to: replyTo?.id || null,
      forwarded_from: null,
      reactions: {}
    };

    setMessages(prev => [...prev, newMsg]);

    ws.send(JSON.stringify({
      type: 'message',
      id: tempId,
      from: user.id,
      to: selectedUser.id,
      text: textToSend,
      reply_to: replyTo?.id || null
    }));

    setInputText('');
    setReplyTo(null);
  };

  // ✏️ Редактирование
  const handleEdit = (message) => {
    const cleanText = getCleanText(message.text);
    const newText = prompt('Редактировать сообщение:', cleanText || message.text);
    if (newText && newText.trim() && ws) {
      const replyPreview = getReplyPreview(message.text);
      let textToSend = newText.trim();
      if (replyPreview) {
        textToSend = `↩️ Ответ: "${replyPreview}"\n${newText.trim()}`;
      }
      ws.send(JSON.stringify({
        type: 'edit_message',
        messageId: message.id,
        to: selectedUser.id,
        text: textToSend
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

    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        if (reactions[user.id] === reaction) {
          delete reactions[user.id];
        } else {
          reactions[user.id] = reaction;
        }
        return { ...msg, reactions };
      }
      return msg;
    }));

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

    const cleanText = getCleanText(message.text);
    const forwardText = `📎 Переслано: ${cleanText || message.text}`;

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
    if (!file || !selectedUser || !ws || isConnecting) return;

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert(`Файл слишком большой! Максимальный размер: 50 MB. Ваш файл: ${(file.size / 1024 / 1024).toFixed(1)} MB`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    const isAllowed = allowedTypes.some(type => file.type.startsWith(type) || file.type === type);

    if (!isAllowed) {
      alert('Неподдерживаемый тип файла! Разрешены: изображения, видео, аудио, PDF, Word, TXT');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');

      const fileData = await response.json();

      let fileText = '';
      if (fileData.type === 'image') {
        fileText = `📷 Изображение: ${API_URL}${fileData.url}`;
      } else if (fileData.type === 'audio') {
        fileText = `🎵 Аудио: ${fileData.name} ${API_URL}${fileData.url}`;
      } else if (fileData.type === 'video') {
        fileText = `🎬 Видео: ${fileData.name} ${API_URL}${fileData.url}`;
      } else {
        fileText = `📎 Файл: ${fileData.name} ${API_URL}${fileData.url}`;
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
        read: 0,
        reactions: {}
      }]);

    } catch (error) {
      console.error('File upload error:', error);
      alert('Ошибка загрузки файла');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTyping = () => {
    if (ws && selectedUser && !isConnecting) {
      ws.send(JSON.stringify({ type: 'typing', from: user.id, to: selectedUser.id }));
    }
  };

  const reactionsList = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  // Фильтрация пользователей по поиску
  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Форма входа
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="logo">💬</div>
          <h2>{isLogin ? 'Добро пожаловать' : 'Создать аккаунт'}</h2>
          <p className="subtitle">
            {isLogin ? 'Войдите в свой аккаунт' : 'Зарегистрируйтесь и начните общение'}
          </p>
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
          <div className="auth-divider">
            <span>или</span>
          </div>
          <span className="toggle-auth" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
          </span>
        </div>
      </div>
    );
  }

  // Основной интерфейс
  return (
    <div className="messenger">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="user-profile">
          <div
            className="avatar"
            style={{ background: getAvatarColor(user.username) }}
          >
            {user.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <div className="username">{user.username}</div>
            <div className="user-status">
              <span className="dot"></span>
              {isConnecting ? 'Подключение...' : 'В сети'}
            </div>
          </div>
          <div className="profile-actions">
            <button onClick={toggleTheme} title="Тёмная тема">
              {isDarkTheme ? '☀️' : '🌙'}
            </button>
            <button title="Настройки">⚙️</button>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Поиск контактов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chats-list">
          <div className="section-title">Контакты</div>
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>Ничего не найдено</h3>
              <p>Попробуйте изменить запрос</p>
            </div>
          ) : (
            filteredUsers.map(u => (
              <div
                key={u.id}
                className={`chat-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                onClick={() => setSelectedUser(u)}
              >
                <div
                  className="avatar"
                  style={{ background: getAvatarColor(u.username) }}
                >
                  {u.username?.[0]?.toUpperCase() || 'U'}
                  {u.online && <span className="online-dot"></span>}
                </div>
                <div className="chat-info">
                  <div className="chat-name">{u.username}</div>
                  <div className="chat-last-msg">
                    {u.online ? '🟢 В сети' : '⚫ Не в сети'}
                  </div>
                </div>
                <div className="chat-meta">
                  <div className="chat-time">
                    {u.last_seen ? new Date(u.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div
                className="avatar"
                style={{ background: getAvatarColor(selectedUser.username) }}
              >
                {selectedUser.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="chat-user-info">
                <div className="chat-user-name">{selectedUser.username}</div>
                <div className={`chat-user-status ${selectedUser.online ? 'online' : ''}`}>
                  {typing ? '✍️ Печатает...' : (selectedUser.online ? '🟢 В сети' : '⚫ Не в сети')}
                </div>
              </div>
              <div className="chat-actions">
                <button title="Поиск">🔍</button>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {groupMessagesByDate(messages).map((group, groupIdx) => (
                <React.Fragment key={groupIdx}>
                  <div className="date-divider">
                    <span>{group.date}</span>
                  </div>
                  {group.messages.map(msg => {
                    const isOwn = msg.from_user === user.id;
                    const isDeleted = msg.deleted || msg.text === '🗑️ Сообщение удалено';
                    const msgReactions = msg.reactions || {};
                    const reactionEntries = Object.entries(msgReactions);

                    return (
                      <div
                        key={msg.id}
                        className={`message ${isOwn ? 'sent' : 'received'} ${isDeleted ? 'deleted' : ''}`}
                      >
                        <div className="message-wrapper">
                          {/* Message Actions */}
                          {!isDeleted && (
                            <div className="message-actions">
                              <button onClick={() => setReplyTo(msg)} title="Ответить">↩️</button>
                              <button onClick={() => forwardMessage(msg)} title="Переслать">📎</button>
                              {isOwn && (
                                <button onClick={() => handleEdit(msg)} title="Редактировать">✏️</button>
                              )}
                              <button onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)} title="Реакции">😊</button>
                              {isOwn && (
                                <button onClick={() => handleDelete(msg.id)} title="Удалить">🗑️</button>
                              )}
                            </div>
                          )}

                          {/* Reactions Picker */}
                          {!isDeleted && showReactions === msg.id && (
                            <div className="reactions-picker">
                              {reactionsList.map(r => (
                                <button key={r} onClick={() => addReaction(msg.id, r)}>{r}</button>
                              ))}
                            </div>
                          )}

                          {/* Message Bubble */}
                          <div className="bubble">
                            {renderMessageContent(msg, isOwn)}
                          </div>

                          {/* Message Footer */}
                          <div className="message-footer">
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOwn && !isDeleted && (
                              <span className="read-status">{msg.read ? '✓✓' : '✓'}</span>
                            )}
                            {msg.edited && !isDeleted && <span className="edited-mark">(ред.)</span>}
                          </div>

                          {/* Reactions Display */}
                          {!isDeleted && reactionEntries.length > 0 && (
                            <div className="reactions-display">
                              {reactionEntries.map(([userId, reaction]) => (
                                <span key={userId} className="reaction">
                                  {reaction}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typing && (
              <div className="typing-indicator">
                <span>{selectedUser.username} печатает</span>
                <div className="dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            {/* Reply Bar */}
            {replyTo && (
              <div className="reply-bar">
                <div className="reply-info">
                  <span className="reply-label">↩️ Ответ</span>
                  <span className="reply-text">
                    {getMessagePreview(replyTo)}
                  </span>
                </div>
                <button className="reply-close" onClick={() => setReplyTo(null)}>✖</button>
              </div>
            )}

            {/* Input Area */}
            <div className="input-area">
              <div className="input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Введите сообщение..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      setInputText(prev => prev + '\n');
                    }
                  }}
                  onKeyUp={handleTyping}
                  disabled={isConnecting}
                />
                <button className="emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  😊
                </button>
              </div>
              {showEmojiPicker && (
                <div className="emoji-picker">
                  {emojiList.map(emoji => (
                    <button key={emoji} onClick={() => insertEmoji(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <label className="file-btn" title="Прикрепить файл">
                📎
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={sendFile}
                  style={{ display: 'none' }}
                  disabled={isConnecting}
                />
              </label>
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!inputText.trim() || isConnecting}
              >
                {isConnecting ? '⏳' : '➤'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-chat">
            <div className="empty-icon">💬</div>
            <h3>Выберите чат</h3>
            <p>Начните общение, выбрав контакт из списка слева</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;