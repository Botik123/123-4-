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

  const updateUserStatus = useCallback((userId, online, lastSeen) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, online, lastSeen } : u
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