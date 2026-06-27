const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/queries');
const { generateToken, generateRefreshToken, authMiddleware } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

// Настройка куки
const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: false, // false для localhost, true для production
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
  });
};

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
    const refreshToken = generateRefreshToken(userId);

    const { broadcastNewUser } = require('../socket');
    broadcastNewUser({ id: userId, username });

    setAuthCookies(res, token, refreshToken);

    res.json({
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
    const refreshToken = generateRefreshToken(user.id);

    setAuthCookies(res, token, refreshToken);

    res.json({
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

// Проверка текущего пользователя
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Logout (очистка куки)
router.post('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

// Refresh endpoint
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Нет refresh токена' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const config = require('../config');
    const decoded = jwt.verify(refreshToken, config.jwtSecret);
    
    const newAccessToken = generateToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);
    
    setAuthCookies(res, newAccessToken, newRefreshToken);
    
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: 'Недействительный refresh токен' });
  }
});