// Цвет аватара
export const getAvatarColor = (name) => {
  if (!name) return '#667eea';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8A5C', '#A29BFE', '#FD79A8', '#00CEC9', '#FDCB6E', '#E17055', '#00B894', '#6C5CE7', '#FD79A8'];
  return colors[Math.abs(hash) % colors.length];
};

// Экранирование HTML (XSS защита)
export const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Парсинг файлового сообщения
export const parseFileMessage = (text) => {
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

// Получение превью сообщения для ответа
export const getMessagePreview = (msg) => {
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

// Получение чистого текста без префикса ответа
export const getCleanText = (text) => {
  if (!text) return '';
  const replyMatch = text.match(/^↩️ Ответ: "[^"]*"\n/);
  if (replyMatch) {
    return text.substring(replyMatch[0].length);
  }
  return text;
};

// Получение превью ответа
export const getReplyPreview = (text) => {
  if (!text) return null;
  const replyMatch = text.match(/^↩️ Ответ: "([^"]*)"\n/);
  if (replyMatch) {
    return replyMatch[1];
  }
  return null;
};

// Группировка сообщений по дате
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