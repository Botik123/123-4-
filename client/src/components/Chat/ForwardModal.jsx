import React, { useState, useMemo } from 'react';
import Avatar from '../Common/Avatar';

const ForwardModal = ({ 
  isOpen, 
  onClose, 
  message, 
  users, 
  currentUserId,
  onForward 
}) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Фильтруем текущего пользователя и ищем по имени
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.id !== currentUserId &&
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, currentUserId, searchQuery]);

  const toggleUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleForward = () => {
    if (selectedUsers.length === 0) {
      alert('Выберите хотя бы одного получателя');
      return;
    }
    
    onForward(message, selectedUsers);
    onClose();
    setSelectedUsers([]);
    setSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal forward-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📎 Переслать сообщение</h3>
          <button className="modal-close" onClick={onClose}>✖</button>
        </div>

        <div className="modal-body">
          {/* Поиск */}
          <div className="forward-search">
            <input
              type="text"
              placeholder="Поиск контактов..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Выбрано */}
          {selectedUsers.length > 0 && (
            <div className="forward-selected">
              <span>Выбрано: {selectedUsers.length}</span>
              <button 
                className="clear-selected"
                onClick={() => setSelectedUsers([])}
              >
                Очистить
              </button>
            </div>
          )}

          {/* Список пользователей */}
          <div className="forward-users-list">
            {filteredUsers.map(user => (
              <div
                key={user.id}
                className={`forward-user-item ${selectedUsers.includes(user.id) ? 'selected' : ''}`}
                onClick={() => toggleUser(user.id)}
              >
                <Avatar name={user.username} size="medium" online={user.online} />
                <div className="forward-user-info">
                  <div className="forward-username">{user.username}</div>
                  <div className="forward-status">
                    {user.online ? '🟢 В сети' : `⚫ Не в сети`}
                  </div>
                </div>
                <div className="forward-checkbox">
                  {selectedUsers.includes(user.id) ? '✅' : '⬜'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Футер с кнопкой */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Отмена
          </button>
          <button 
            className="btn-forward" 
            onClick={handleForward}
            disabled={selectedUsers.length === 0}
          >
            Переслать ({selectedUsers.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
