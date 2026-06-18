const db = require('./index');

module.exports = {
  // ============ ПОЛЬЗОВАТЕЛИ ============
  
  getUserById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, username, avatar FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  },

  getUserByUsername: (username) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  },

  createUser: (id, username, password) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (id, username, password, last_seen) VALUES (?, ?, ?, ?)',
        [id, username, password, Date.now()],
        function(err) {
          if (err) reject(err);
          resolve({ id, username });
        }
      );
    });
  },

  getAllUsers: (excludeId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, username, avatar FROM users WHERE id != ?', [excludeId], (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      });
    });
  },

  // ============ СООБЩЕНИЯ ============
  
  createMessage: (id, from, to, text, timestamp, replyTo, forwardedFrom, clientId) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO messages (id, from_user, to_user, text, timestamp, read, reply_to, forwarded_from, client_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, from, to, text, timestamp, 0, replyTo || null, forwardedFrom || null, clientId || null],
        function(err) {
          if (err) reject(err);
          resolve({ id, from, to, text, timestamp });
        }
      );
    });
  },

  getMessagesBetweenUsers: (userId1, userId2, limit = 200) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM messages 
         WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
         AND deleted = 0
         ORDER BY timestamp ASC LIMIT ?`,
        [userId1, userId2, userId2, userId1, limit],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows || []);
        }
      );
    });
  },

  editMessage: (id, text) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE messages SET text = ?, edited = 1, edited_at = ? WHERE id = ?',
        [text, Date.now(), id],
        function(err) {
          if (err) reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  },

  deleteMessage: (id) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE messages SET deleted = 1, text = "🗑️ Сообщение удалено" WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  },

  getMessageById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM messages WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  },

  getMessageFile: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT file_path FROM messages WHERE id = ? AND file_path IS NOT NULL', [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  },

  getAllFilePaths: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT file_path FROM messages WHERE file_path IS NOT NULL AND deleted = 0', (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      });
    });
  },

  updateMessageFile: (id, filePath) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE messages SET file_path = ? WHERE id = ?',
        [filePath, id],
        function(err) {
          if (err) reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  },

  markMessagesAsRead: (from, to) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE messages SET read = 1 WHERE from_user = ? AND to_user = ?',
        [from, to],
        function(err) {
          if (err) reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  },

  // ============ РЕАКЦИИ ============
  
  addReaction: (id, messageId, userId, reaction) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO message_reactions (id, message_id, user_id, reaction, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, messageId, userId, reaction, Date.now()],
        function(err) {
          if (err) reject(err);
          resolve({ id, messageId, userId, reaction });
        }
      );
    });
  },

  getReactions: (messageId) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT user_id, reaction FROM message_reactions WHERE message_id = ?',
        [messageId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows || []);
        }
      );
    });
  }
};