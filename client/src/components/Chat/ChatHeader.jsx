import React from 'react';
import Avatar from '../Common/Avatar';
import { formatLastSeen } from '../../utils/helpers';

const ChatHeader = ({ user, typing, isOnline }) => {
  return (
    <div className="chat-header">
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