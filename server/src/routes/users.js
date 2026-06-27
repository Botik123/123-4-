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
    const onlineClientIds = new Set(clients.keys());
    
    const usersWithStatus = users.map(user => ({
      ...user,
      online: onlineClientIds.has(user.id),
      last_seen: onlineClientIds.has(user.id) ? Date.now() : null
    }));

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

module.exports = router;