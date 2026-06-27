/**
 * @file client/src/api/index.js
 * @description API клиент для взаимодействия с сервером
 * Все HTTP запросы к бэкенду мессенджера
 */

const API_URL = 'http://localhost:3002';

/**
 * Получить токен из localStorage
 */
const getToken = () => localStorage.getItem('token');

/**
 * Базовый запрос с авторизацией
 * @param {string} endpoint - URL endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Данные ответа
 * @throws {Error} Ошибка запроса
 */
const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include' // Отправляем куки
    });
  } catch (networkError) {
    console.error('Network error:', networkError.message);
    throw new Error('Ошибка сети. Проверьте подключение к серверу.');
  }

  // Обработка пустого ответа
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }

  return data;
};

// ==========================================
// === AUTH API: Регистрация и вход ===
// ==========================================
export const authAPI = {
  /**
   * Войти в аккаунт
   * @param {string} username 
   * @param {string} password 
   */
  login: (username, password) => 
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  
  /**
   * Зарегистрировать нового пользователя
   * @param {string} username 
   * @param {string} password 
   */
  register: (username, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
};

// ==========================================
// === USERS API: Пользователи ===
// ==========================================
export const usersAPI = {
  /**
   * Получить всех пользователей (кроме текущего)
   */
  getAll: () => request('/users')
};

// ==========================================
// === MESSAGES API: Сообщения ===
// ==========================================
export const messagesAPI = {
  /**
   * Получить историю переписки
   * @param {string} userId - ID текущего пользователя
   * @param {string} otherUserId - ID собеседника
   */
  getHistory: (userId, otherUserId) => 
    request(`/messages/${userId}/${otherUserId}`),
  
  /**
   * Отправить сообщение
   * @param {string} to - ID получателя
   * @param {string} text - Текст сообщения
   * @param {string|null} replyTo - ID сообщения для ответа
   * @param {string|null} chatId - ID комнаты
   * @param {string} clientId - Уникальный ID для идемпотентности
   */
  send: (to, text, replyTo, chatId, clientId) =>
    request('/messages', {
      method: 'POST',
      body: JSON.stringify({ to, text, reply_to: replyTo, chatId, clientId })
    }),
  
  /**
   * Редактировать сообщение
   * @param {string} messageId 
   * @param {string} text - Новый текст
   * @param {string} to - ID получателя
   */
  edit: (messageId, text, to) =>
    request(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ text, to })
    }),
  
  /**
   * Удалить сообщение
   * @param {string} messageId 
   * @param {string} to - ID получателя
   */
  delete: (messageId, to) =>
    request(`/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ to })
    }),
  
  /**
   * Переслать сообщение
   * @param {string} to - ID получателя
   * @param {string} messageId - ID исходного сообщения
   */
  forward: (to, messageId) =>
    request('/messages/forward', {
      method: 'POST',
      body: JSON.stringify({ to, messageId })
    }),
  
  /**
   * Переслать сообщение нескольким получателям
   * @param {string[]} to - Массив ID получателей
   * @param {string} messageId - ID исходного сообщения
   */
  forwardMultiple: (to, messageId) => {
    console.log('📎 API forwardMultiple: to=', to, 'messageId=', messageId);
    return request('/messages/forward/multiple', {
      method: 'POST',
      body: JSON.stringify({ to, messageId })
    });
  },
  
  /**
   * Добавить реакцию
   * @param {string} messageId 
   * @param {string} reaction - Эмодзи реакции
   * @param {string} to - ID получателя
   */
  addReaction: (messageId, reaction, to) =>
    request('/messages/reaction', {
      method: 'POST',
      body: JSON.stringify({ messageId, reaction, to })
    }),
  
  /**
   * Отметить сообщения как прочитанные
   * @param {string} from - ID отправителя
   */
  markAsRead: (from) =>
    request('/messages/read', {
      method: 'POST',
      body: JSON.stringify({ from })
    })
};

// ==========================================
// === UPLOAD API: Загрузка файлов ===
// ==========================================
export const uploadAPI = {
  /**
   * Загрузить файл на сервер
   * @param {File} file - Файл для загрузки
   * @returns {object} Информация о загруженном файле
   */
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = getToken();
    
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка загрузки');
    }
    
    return data;
  }
};