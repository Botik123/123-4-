/**
 * @file server/src/middleware/auth.js
 * @description Middleware для JWT-аутентификации
 * Генерация и верификация токенов, защита маршрутов
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Генерирует JWT токен для пользователя
 * @param {string} userId - ID пользователя
 * @returns {string} JWT токен
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
};

/**
 * Верифицирует JWT токен
 * @param {string} token - Токен для проверки
 * @returns {object|null} Декодированные данные или null при ошибке
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

/**
 * Middleware для защиты маршрутов
 * Проверяет заголовок Authorization: Bearer <token>
 * Добавляет decoded.userId в req.user
 */
const authMiddleware = (req, res, next) => {
  // Проверка наличия заголовка
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  // Извлечение токена из "Bearer <token>"
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  // Сохраняем данные пользователя в запросе для последующих middleware
  req.user = {
    id: decoded.userId
  };
  
  next();
};

module.exports = { generateToken, verifyToken, authMiddleware };