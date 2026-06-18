import React, { memo } from 'react';
import Avatar from '../Common/Avatar';
import { formatLastSeen } from '../../utils/helpers';

const ChatItem = memo(({ user, isSelected, onSelect }) => (
  <div
    className={`chat-item ${isSelected ? 'active' : ''}`}
    onClick={() => onSelect(user)}
  >
    <Avatar name={user.username} size="medium" online={user.online} />
    <div className="chat-info">
      <div className="chat-name">{user.username}</div>
      <div className="chat-last-msg">
        {user.online ? '🟢 В сети' : `⚫ ${formatLastSeen(user.last_seen)}`}
      </div>
    </div>
  </div>
));

const ChatList = ({ users, selectedUserId, onSelectUser, searchQuery }) => {
  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredUsers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>Ничего не найдено</h3>
        <p>Попробуйте изменить запрос</p>
      </div>
    );
  }

  return (
    <div className="chats-list">
      <div className="section-title">Контакты</div>
      {filteredUsers.map(user => (
        <ChatItem
          key={user.id}
          user={user}
          isSelected={selectedUserId === user.id}
          onSelect={onSelectUser}
        />
      ))}
    </div>
  );
};

export default ChatList;