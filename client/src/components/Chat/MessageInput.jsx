import React, { useState, useRef } from 'react';
import EmojiPicker from '../Common/EmojiPicker';

const MessageInput = ({ 
  onSend, 
  onTyping, 
  disabled, 
  placeholder = 'Введите сообщение...' 
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
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

  const handleTyping = () => {
    if (onTyping) onTyping();
  };

  const insertEmoji = (emoji) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
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
          onKeyPress={handleKeyPress}
          onKeyUp={handleTyping}
          disabled={disabled}
        />
        <button 
          className="emoji-btn" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          😊
        </button>
      </div>
      
      {showEmojiPicker && (
        <EmojiPicker 
          onSelect={insertEmoji} 
          onClose={() => setShowEmojiPicker(false)} 
        />
      )}
      
      <button 
        className="send-btn" 
        onClick={handleSend}
        disabled={!text.trim() || disabled}
      >
        {disabled ? '⏳' : '➤'}
      </button>
    </div>
  );
};

export default MessageInput;