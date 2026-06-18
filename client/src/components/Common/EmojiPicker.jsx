import React from 'react';
import { EMOJI_LIST } from '../../utils/constants';

const EmojiPicker = ({ onSelect, onClose }) => {
  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="emoji-picker">
      {EMOJI_LIST.map(emoji => (
        <button key={emoji} onClick={() => handleEmojiClick(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiPicker;