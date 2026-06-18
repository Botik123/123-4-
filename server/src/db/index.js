const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../../messenger.db'));

db.serialize(() => {
  // Пользователи
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      last_seen INTEGER
    )
  `);

  // Сообщения
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      read INTEGER DEFAULT 0,
      edited INTEGER DEFAULT 0,
      edited_at INTEGER,
      reply_to TEXT,
      forwarded_from TEXT,
      deleted INTEGER DEFAULT 0,
      FOREIGN KEY(from_user) REFERENCES users(id),
      FOREIGN KEY(to_user) REFERENCES users(id)
    )
  `);

  // Реакции
  db.run(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reaction TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY(message_id) REFERENCES messages(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(message_id, user_id)
    )
  `);

  console.log('✅ SQLite база данных готова');
});

module.exports = db;