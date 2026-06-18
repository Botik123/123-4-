const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../../messenger.db'));

// 🔥 ФИКС: Включаем WAL режим для избежания SQLITE_BUSY
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA synchronous = NORMAL;');

db.serialize(() => {
  // Таблица пользователей
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
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

  // 🔥 ФИКС: Индексы для ускорения запросов
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user)`);
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

  console.log('✅ SQLite база данных готова (WAL режим включён)');
});

module.exports = db;