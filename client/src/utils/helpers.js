/**
 * @file client/src/utils/helpers.js
 * @description Вспомогательные утилиты для мессенджера
 * Парсинг сообщений, форматирование, группировка
 */

import { API_URL } from './constants';

/**
 * Генерирует цвет для аватара на основе имени
 * @param {string} name - Имя пользователя
 * @returns {string} HEX цвет
 */
export const getAvatarColor = (name) => {
  if (!name) return '#667eea';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8A5C', '#A29BFE', '#FD79A8', '#00CEC9', '#FDCB6E', '#E17055', '#00B894', '#6C5CE7', '#FD79A8'];
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Экранирование HTML для защиты от XSS
 * @param {string} text - Текст для экранирования
 * @returns {string} Безопасный HTML
 */
export const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Форматирование времени "был(а) в сети"
 * @param {number} timestamp - Unix timestamp последнего посещения
 * @returns {string} Человекочитаемый формат
 */
export const formatLastSeen = (timestamp) => {
  if (!timestamp) return 'Не в сети';
  
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дн назад`;
  
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Парсинг текстового сообщения с файлом
 * @param {string} text - Текст сообщения
 * @returns {object|null} Объект с типом и URL файла
 */
export const parseFileMessage = (text) => {
  if (!text || typeof text !== 'string') return null;
  
  if (text === '🗑️ Сообщение удалено') {
    return { type: 'deleted' };
  }
  
  // Парсинг изображений: 📷 Изображение: name url
  const imageMatch = text.match(/📷 Изображение:\s*([^\n]+?)\s+(https?:\/\/[^\s]+)/);
  if (imageMatch) {
    return { 
      type: 'image', 
      name: imageMatch[1]?.trim() || 'Изображение',
      url: imageMatch[2] 
    };
  }
  
  // Парсинг аудио: 🎵 Аудио: name url
  const audioMatch = text.match(/🎵 Аудио:\s*([^\n]+?)\s+(https?:\/\/[^\s]+)/);
  if (audioMatch) {
    return { 
      type: 'audio', 
      name: audioMatch[1]?.trim() || 'Аудио', 
      url: audioMatch[2] 
    };
  }
  
  // Парсинг видео: 🎬 Видео: name url
  const videoMatch = text.match(/🎬 Видео:\s*([^\n]+?)\s+(https?:\/\/[^\s]+)/);
  if (videoMatch) {
    return { 
      type: 'video', 
      name: videoMatch[1]?.trim() || 'Видео', 
      url: videoMatch[2] 
    };
  }
  
  // Парсинг файлов: 📎 Файл: name url
  const fileMatch = text.match(/📎 Файл:\s*([^\n]+?)\s+(https?:\/\/[^\s]+)/);
  if (fileMatch) {
    return { 
      type: 'file', 
      name: fileMatch[1]?.trim() || 'Файл', 
      url: fileMatch[2] 
    };
  }
  
  return null;
};

/**
 * Получение превью сообщения для отображения в ответе
 * @param {object} msg - Объект сообщения
 * @returns {string} Краткое превью
 */
export const getMessagePreview = (msg) => {
  if (!msg) return '';
  
  if (msg.deleted || msg.text === '🗑️ Сообщение удалено') {
    return '🗑️ Сообщение удалено';
  }
  
  const fileData = parseFileMessage(msg.text);
  if (fileData) {
    switch (fileData.type) {
      case 'image': return `📷 ${fileData.name || 'Изображение'}`;
      case 'audio': return `🎵 ${fileData.name || 'Аудио'}`;
      case 'video': return `🎬 ${fileData.name || 'Видео'}`;
      case 'file': return `📎 ${fileData.name || 'Файл'}`;
      default: return '📎 Файл';
    }
  }
  
  const cleanText = getCleanText(msg.text);
  return cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
};

/**
 * Удаление префикса ответа из текста
 * @param {string} text - Исходный текст
 * @returns {string} Очищенный текст
 */
export const getCleanText = (text) => {
  if (!text) return '';
  const replyMatch = text.match(/^↩️ Ответ: "[^"]*"\n/);
  if (replyMatch) {
    return text.substring(replyMatch[0].length);
  }
  return text;
};

/**
 * Извлечение текста ответа из сообщения
 * @param {string} text - Текст сообщения
 * @returns {string|null} Текст ответа или null
 */
export const getReplyPreview = (text) => {
  if (!text) return null;
  const replyMatch = text.match(/^↩️ Ответ: "([^"]*)"\n/);
  if (replyMatch) {
    return replyMatch[1];
  }
  return null;
};

/**
 * Группировка сообщений по дате для отображения разделителей
 * @param {array} messages - Массив сообщений
 * @returns {array} Группированные сообщения
 */
export const groupMessagesByDate = (messages) => {
  const groups = [];
  let currentDate = null;
  let currentGroup = [];

  messages.forEach(msg => {
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