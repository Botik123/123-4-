import React from 'react';
import Avatar from '../Common/Avatar';
import { formatLastSeen } from '../../utils/helpers';

const ChatHeader = ({ user, typing, isOnline, onBack }) => {
  const isMobile = window.innerWidth <= 768;
  
  return (
    <div className="chat-header">
      {isMobile && (
        <button className="chat-back-btn" onClick={onBack} title="Назад">
          ←
        </button>
      )}
      
      <Avatar name={user?.username} size="medium" online={isOnline} />
      
      <div className="chat-user-info">
        <div className="chat-user-name">{user?.username}</div>
        <div className={`chat-user-status ${isOnline ? 'online' : ''}`}>
          {typing ? '✍️ Печатает...' : (isOnline ? '🟢 В сети' : `⚫ ${formatLastSeen(user?.last_seen)}`)}
        </div>
      </div>
      
      <div className="chat-actions">
        <button title="Поиск">🔍</button>
      </div>
    </div>
  );
};

export default ChatHeader;