import React from 'react';

const Skeleton = ({ type = 'text', count = 1, className = '' }) => {
  if (type === 'chat-item') {
    return (
      <div className="skeleton-chat-item">
        <div className="skeleton-avatar"></div>
        <div className="skeleton-lines">
          <div className="skeleton-line skeleton-line-title"></div>
          <div className="skeleton-line skeleton-line-sub"></div>
        </div>
      </div>
    );
  }

  if (type === 'message-sent') {
    return (
      <div className="skeleton-message sent">
        <div className="skeleton-bubble"></div>
      </div>
    );
  }

  if (type === 'message-received') {
    return (
      <div className="skeleton-message received">
        <div className="skeleton-bubble"></div>
      </div>
    );
  }

  // Обычный скелетон (текст)
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${80 - i * 10}%` }}></div>
      ))}
    </div>
  );
};

export default Skeleton;