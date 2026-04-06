/**
 * @deprecated Этот файл устарел.
 * Используйте вместо него: config/db.js
 *
 * Этот файл оставлен только для обратной совместимости.
 */

const { initializeDb, getDb } = require('./db');

/**
 * @deprecated Используйте initializeDb() из ./db
 */
function initializeFirebase() {
  return initializeDb().then(dbConfig => {
    return {
      admin: dbConfig.admin,
      db: dbConfig.db,
    };
  });
}

module.exports = { initializeFirebase };
