import React from 'react';
import Avatar from '../Common/Avatar';
import { formatLastSeen } from '../../utils/helpers';

const ChatHeader = ({ user, typing, isOnline }) => {
  // Используем isOnline из пропсов или user.online
  const onlineStatus = isOnline !== undefined ? isOnline : user?.online || false;
  
  return (
    <div className="chat-header">
      <Avatar name={user?.username} size="medium" online={onlineStatus} />
      <div className="chat-user-info">
        <div className="chat-user-name">{user?.username}</div>
        <div className={`chat-user-status ${onlineStatus ? 'online' : ''}`}>
          {typing ? '✍️ Печатает...' : (onlineStatus ? '🟢 В сети' : `⚫ ${formatLastSeen(user?.last_seen)}`)}
        </div>
      </div>
      <div className="chat-actions">
        <button title="Поиск">🔍</button>
      </div>
    </div>
  );
};

export default ChatHeader;