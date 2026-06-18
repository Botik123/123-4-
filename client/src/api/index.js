const API_URL = 'http://localhost:3001';

const getToken = () => localStorage.getItem('token');

const request = async (endpoint, options = {}) => {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }

  return data;
};

// Авторизация
export const authAPI = {
  login: (username, password) => 
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  
  register: (username, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
};

// Пользователи
export const usersAPI = {
  getAll: () => request('/users')
};

// Сообщения
export const messagesAPI = {
  getHistory: (userId, otherUserId) => 
    request(`/messages/${userId}/${otherUserId}`),
  
  send: (to, text, replyTo) =>
    request('/messages', {
      method: 'POST',
      body: JSON.stringify({ to, text, reply_to: replyTo })
    }),
  
  edit: (messageId, text, to) =>
    request(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ text, to })
    }),
  
  delete: (messageId, to) =>
    request(`/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ to })
    }),
  
  addReaction: (messageId, reaction, to) =>
    request('/messages/reaction', {
      method: 'POST',
      body: JSON.stringify({ messageId, reaction, to })
    }),
  
  markAsRead: (from) =>
    request('/messages/read', {
      method: 'POST',
      body: JSON.stringify({ from })
    })
};

// Файлы
export const uploadAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    }).then(res => res.json());
  }
};