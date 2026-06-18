require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3002,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-me',
  uploadDir: './uploads',
  maxFileSize: 50 * 1024 * 1024,
};