import React, { memo } from 'react';
import Avatar from '../Common/Avatar';
import Skeleton from '../Common/Skeleton';
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

const ChatList = ({ users, selectedUserId, onSelectUser, searchQuery, loading, currentUserId }) => {
  const filteredUsers = users.filter(u =>
    u.id !== currentUserId && // Не показывать текущего пользователя
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🔥 ПОКАЗЫВАЕМ СКЕЛЕТОН ВО ВРЕМЯ ЗАГРУЗКИ
  if (loading) {
    return (
      <div className="chats-list">
        <div className="section-title">Контакты</div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} type="chat-item" />
        ))}
      </div>
    );
  }

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