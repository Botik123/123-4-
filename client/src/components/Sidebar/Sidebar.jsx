import React, { useState } from 'react';
import UserProfile from './UserProfile';
import SearchBar from './SearchBar';
import ChatList from './ChatList';

const Sidebar = ({ 
  user, 
  users, 
  selectedUser, 
  onSelectUser, 
  isConnecting,
  onToggleTheme,
  isDarkTheme,
  onLogout
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="sidebar">
      <UserProfile 
        user={user}
        isConnecting={isConnecting}
        onToggleTheme={onToggleTheme}
        isDarkTheme={isDarkTheme}
        onLogout={onLogout}
      />
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <ChatList 
        users={users}
        selectedUserId={selectedUser?.id}
        onSelectUser={onSelectUser}
        searchQuery={searchQuery}
      />
    </div>
  );
};

export default Sidebar;