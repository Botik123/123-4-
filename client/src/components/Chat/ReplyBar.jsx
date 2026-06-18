import React from 'react';
import { getMessagePreview } from '../../utils/helpers';

const ReplyBar = ({ replyTo, onClose }) => {
  if (!replyTo) return null;
  
  const preview = getMessagePreview(replyTo);
  
  return (
    <div className="reply-bar">
      <div className="reply-info">
        <span className="reply-label">↩️ Ответ</span>
        <span className="reply-text">{preview}</span>
      </div>
      <button className="reply-close" onClick={onClose}>✖</button>
    </div>
  );
};

export default ReplyBar;