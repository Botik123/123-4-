import React from 'react';

const TypingIndicator = ({ username }) => {
  return (
    <div className="typing-indicator-wrapper">
      <span className="typing-text">{username} печатает</span>
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
};

export default TypingIndicator;