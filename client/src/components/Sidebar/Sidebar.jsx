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
  const [isMobileOpen, setIsMobileOpen] = useState(true);

  // Фильтруем текущего пользователя из списка контактов
  const filteredUsers = users.filter(u => u.id !== user?.id);

  return (
    <div className={`sidebar ${isMobileOpen ? 'open' : 'closed'}`}>
      <UserProfile 
        user={user}
        isConnecting={isConnecting}
        onToggleTheme={onToggleTheme}
        isDarkTheme={isDarkTheme}
        onLogout={onLogout}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <ChatList 
        users={filteredUsers}
        selectedUserId={selectedUser?.id}
        onSelectUser={(user) => {
          onSelectUser(user);
          if (window.innerWidth <= 768) {
            setIsMobileOpen(false);
          }
        }}
        searchQuery={searchQuery}
      />
    </div>
  );
};

export default Sidebar;