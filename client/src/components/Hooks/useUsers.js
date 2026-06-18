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

  // ИСПРАВЛЕННОЕ ОБНОВЛЕНИЕ СТАТУСА
  const updateUserStatus = useCallback((userId, online, lastSeen) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return { 
          ...u, 
          online: online === true, // Приводим к boolean
          last_seen: lastSeen || Date.now()
        };
      }
      return u;
    }));
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    addUser,
    updateUserStatus
  };
};