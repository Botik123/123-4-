import { useState, useCallback } from 'react';
import { usersAPI } from '../../api';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersAPI.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addUser = useCallback((user) => {
    setUsers(prev => {
      if (prev.find(u => u.id === user.id)) return prev;
      return [...prev, user];
    });
  }, []);

  // Обновление статуса пользователя (онлайн/оффлайн)
  const updateUserStatus = useCallback((userId, online, lastSeen) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return { 
          ...u, 
          online: online === true || online === 'true' || online === 1,
          last_seen: lastSeen || Date.now()
        };
      }
      return u;
    }));
  }, []);

  // Обновление статуса для конкретного пользователя (используется в Sidebar)
  const updateUserOnline = useCallback((userId, isOnline) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, online: isOnline } : u
    ));
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    addUser,
    updateUserStatus
  };
};