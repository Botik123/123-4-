import React, { useState, useRef } from 'react';
import EmojiPicker from '../Common/EmojiPicker';
import { uploadAPI } from '../../api';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '../../utils/constants';

const MessageInput = ({ 
  onSend, 
  onTyping, 
  onFileSend,
  disabled, 
  placeholder = 'Введите сообщение...' 
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`Файл слишком большой! Максимум ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    const isAllowed = ALLOWED_FILE_TYPES.some(type => file.type.startsWith(type) || file.type === type);
    if (!isAllowed) {
      alert('Неподдерживаемый тип файла');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadAPI.upload(file);
      // Формируем правильное сообщение для файла
      let fileText = '';
      if (result.type === 'image') {
        fileText = `📷 Изображение: ${result.url}`;
      } else if (result.type === 'audio') {
        fileText = `🎵 Аудио: ${result.name} ${result.url}`;
      } else if (result.type === 'video') {
        fileText = `🎬 Видео: ${result.name} ${result.url}`;
      } else {
        fileText = `📎 Файл: ${result.name} ${result.url}`;
      }
      
      // Отправляем через onFileSend
      if (onFileSend) {
        onFileSend(fileText);
      } else {
        // Если onFileSend не передан, используем onSend
        onSend(fileText);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Ошибка загрузки файла');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              setText(prev => prev + '\n');
            }
          }}
          onKeyUp={onTyping}
          disabled={disabled || uploading}
        />
        <button 
          className="emoji-btn" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={uploading}
        >
          😊
        </button>
      </div>
      
      {showEmojiPicker && (
        <EmojiPicker 
          onSelect={(emoji) => {
            setText(prev => prev + emoji);
            inputRef.current?.focus();
          }} 
          onClose={() => setShowEmojiPicker(false)} 
        />
      )}
      
      <label className="file-btn" title="Прикрепить файл">
        {uploading ? '⏳' : '📎'}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled || uploading}
        />
      </label>
      
      <button 
        className="send-btn" 
        onClick={handleSend}
        disabled={!text.trim() || disabled || uploading}
      >
        {uploading ? '⏳' : '➤'}
      </button>
    </div>
  );
};

export default MessageInput;