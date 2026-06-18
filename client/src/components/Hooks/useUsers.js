import { useState, useCallback } from 'react';
import { usersAPI } from '../../api';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async (currentUserId) => {
    setLoading(true);
    try {
      const data = await usersAPI.getAll();
      console.log(`📥 fetchUsers: получено ${data.length} пользователей, фильтруем ${currentUserId}`);
      // Фильтруем текущего пользователя
      const filtered = currentUserId ? data.filter(u => u.id !== currentUserId) : data;
      console.log(`📥 После фильтрации: ${filtered.length} пользователей`);
      filtered.forEach(u => console.log(`  - ${u.username} (${u.id})`));
      setUsers(filtered);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addUser = useCallback((user) => {
    console.log(`👤 addUser: ${user?.username} (${user?.id})`);
    setUsers(prev => {
      // Защита от пустого списка
      if (!prev || !Array.isArray(prev)) {
        console.warn('⚠️ addUser: prev users is not an array');
        return user ? [user] : [];
      }
      // Не добавляем дубликаты
      if (prev.find(u => u.id === user?.id)) {
        console.log(`  ℹ️ Пользователь уже есть в списке`);
        return prev;
      }
      const updated = [...prev, user];
      console.log(`  ✅ Добавлен пользователь. Всего: ${updated.length}`);
      return updated;
    });
  }, []);

  // Обновление статуса пользователя (онлайн/оффлайн)
  const updateUserStatus = useCallback((userId, online, lastSeen) => {
    const newOnline = online === true || online === 'true' || online === 1;
    console.log(`🔄 updateUserStatus: userId=${userId}, online=${newOnline}`);
    setUsers(prev => {
      const updated = prev.map(u => {
        if (u.id === userId) {
          console.log(`  ✅ Нашёл пользователя ${u.username}, обновляю online: ${u.online} -> ${newOnline}`);
          return { 
            ...u, 
            online: newOnline,
            last_seen: lastSeen || Date.now()
          };
        }
        return u;
      });
      if (!prev.find(u => u.id === userId)) {
        console.warn(`  ⚠️ Пользователь ${userId} не найден в списке (${prev.length} пользователей)`);
      }
      return updated;
    });
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