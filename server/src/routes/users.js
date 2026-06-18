const express = require('express');
const db = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const users = await db.getAllUsers(req.userId);
    
    const usersWithStatus = users.map(user => ({
      ...user,
      online: false,
      last_seen: null
    }));

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

module.exports = router;