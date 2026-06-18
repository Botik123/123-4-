require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3002,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-me',
  uploadDir: './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
  nodeEnv: process.env.NODE_ENV || 'development',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
};