const express = require('express');
const db = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const users = await db.getAllUsers(userId);
    
    // Получаем список онлайн пользователей из WebSocket клиентов
    const { clients } = require('../socket');
    const onlineClientIds = Array.from(clients.keys());
    
    console.log(`👥 /users: userId=${userId}, всего пользователей=${users.length}, онлайн=${onlineClientIds.length}`);
    console.log(`  📡 Онлайн клиенты: ${onlineClientIds.join(', ') || 'нет'}`);
    
    const usersWithStatus = users.map(user => ({
      ...user,
      online: onlineClientIds.includes(user.id),
      last_seen: onlineClientIds.includes(user.id) ? Date.now() : null
    }));

    console.log(`  ✅ Возвращаем статусы:`, usersWithStatus.map(u => ({ id: u.id, username: u.username, online: u.online })));
    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

module.exports = router;