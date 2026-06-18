import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (isTypingRef.current && onTyping) {
      onTyping(false);
      isTypingRef.current = false;
    }
  };

  const handleTypingDebounced = useCallback(() => {
    if (!onTyping || disabled) return;

    if (!isTypingRef.current) {
      onTyping(true);
      isTypingRef.current = true;
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      if (onTyping) {
        onTyping(false);
        isTypingRef.current = false;
      }
      typingTimerRef.current = null;
    }, 2000);
  }, [onTyping, disabled]);

  useEffect(() => {
    return () => {
      // Очистка таймера при размонтировании
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      // Сброс флага набора текста
      if (isTypingRef.current && onTyping) {
        onTyping(false);
        isTypingRef.current = false;
      }
    };
  }, [onTyping]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setText(value);
    handleTypingDebounced();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      setText(prev => prev + '\n');
    }
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
      let fileText = '';
      if (result.type === 'image') {
        fileText = `📷 Изображение: ${result.name || file.name} ${result.url}`;
      } else if (result.type === 'audio') {
        fileText = `🎵 Аудио: ${result.name || file.name} ${result.url}`;
      } else if (result.type === 'video') {
        fileText = `🎬 Видео: ${result.name || file.name} ${result.url}`;
      } else {
        fileText = `📎 Файл: ${result.name || file.name} ${result.url}`;
      }
      
      if (onFileSend) {
        onFileSend(fileText);
      } else {
        onSend(fileText);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Ошибка загрузки файла: ' + (error.message || 'Неизвестная ошибка'));
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
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
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
            handleTypingDebounced();
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