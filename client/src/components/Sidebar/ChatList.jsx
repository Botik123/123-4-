import React from 'react';
import Avatar from '../Common/Avatar';

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
        <div
          key={user.id}
          className={`chat-item ${selectedUserId === user.id ? 'active' : ''}`}
          onClick={() => onSelectUser(user)}
        >
          <Avatar name={user.username} size="medium" online={user.online} />
          <div className="chat-info">
            <div className="chat-name">{user.username}</div>
            <div className="chat-last-msg">
              {user.online ? '🟢 В сети' : '⚫ Не в сети'}
            </div>
          </div>
          <div className="chat-meta">
            <div className="chat-time">
              {user.last_seen ? new Date(user.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatList;