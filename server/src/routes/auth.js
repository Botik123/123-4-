const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/queries');
const { generateToken } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

router.post('/register', sanitizeBody, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Имя пользователя должно быть от 3 до 20 символов' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть минимум 4 символа' });
  }

  if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Имя пользователя содержит недопустимые символы' });
  }

  try {
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Имя пользователя уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.createUser(userId, username, hashedPassword);

    const token = generateToken(userId);

    // 🔥 Рассылаем нового пользователя всем
    const { broadcastNewUser } = require('../socket');
    broadcastNewUser({ id: userId, username });

    res.json({
      token,
      user: { id: userId, username }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/login', sanitizeBody, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;