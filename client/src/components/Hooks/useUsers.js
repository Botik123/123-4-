import { useState, useCallback } from 'react';
import { usersAPI } from '../../api';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async (currentUserId) => {
    setLoading(true);
    try {
      const data = await usersAPI.getAll();
      // Фильтруем текущего пользователя
      setUsers(currentUserId ? data.filter(u => u.id !== currentUserId) : data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addUser = useCallback((user) => {
    setUsers(prev => {
      // Не добавляем пользователя если он уже есть или это текущий пользователь
      if (prev.find(u => u.id === user.id)) return prev;
      return [...prev, user];
    });
  }, []);

  // Обновление статуса пользователя (онлайн/оффлайн)
  const updateUserStatus = useCallback((userId, online, lastSeen) => {
    console.log(`🔄 updateUserStatus: ${userId}, online=${online}`);
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const newOnline = online === true || online === 'true' || online === 1;
        console.log(`  📍 Обновляем: ${u.username} -> online=${newOnline}`);
        return { 
          ...u, 
          online: newOnline,
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