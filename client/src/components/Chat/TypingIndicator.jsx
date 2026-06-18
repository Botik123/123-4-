import React from 'react';

const TypingIndicator = ({ username }) => {
  return (
    <div className="typing-indicator">
      <span>{username} печатает</span>
      <div className="dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
};

export default TypingIndicator;