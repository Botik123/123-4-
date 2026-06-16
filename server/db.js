const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'messenger.db'));

db.serialize(() => {
  // Таблица пользователей
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      online INTEGER DEFAULT 0,
      last_seen INTEGER
    )
  `);

  // Таблица сообщений
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
      deleted INTEGER DEFAULT 0
    )
  `);

  // Индексы для оптимизации поиска сообщений (чтобы чаты не тормозили)
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_from_to ON messages(from_user, to_user)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);

  // Таблица реакций
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

  console.log('✅ База данных готова и оптимизирована');
});

module.exports = db;