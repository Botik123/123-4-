import React from 'react';
import Avatar from '../Common/Avatar';

const UserProfile = ({ user, isConnecting, onToggleTheme, isDarkTheme, onLogout }) => {
  return (
    <div className="user-profile">
      <Avatar name={user?.username} size="medium" online />
      <div className="user-info">
        <div className="username">{user?.username}</div>
        <div className="user-status">
          <span className="dot"></span>
          {isConnecting ? 'Подключение...' : 'В сети'}
        </div>
      </div>
      <div className="profile-actions">
        <button onClick={onToggleTheme} title="Тёмная тема">
          {isDarkTheme ? '☀️' : '🌙'}
        </button>
        <button onClick={onLogout} title="Выйти">
          🚪
        </button>
      </div>
    </div>
  );
};

export default UserProfile;