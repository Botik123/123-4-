const express = require('express');
const db = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');
const redis = require('../redis');

const router = express.Router();

router.use(authMiddleware);

// Получить список пользователей
router.get('/', async (req, res) => {
  try {
    const users = await db.getAllUsers(req.userId);

    // Добавляем статус онлайн из Redis
    const usersWithStatus = await Promise.all(users.map(async (user) => {
      const online = await redis.get(`user:${user.id}:online`);
      const lastSeen = await redis.get(`user:${user.id}:last_seen`);
      return {
        ...user,
        online: online === 'true',
        last_seen: parseInt(lastSeen) || null
      };
    }));

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

module.exports = router;