/**
 * Универсальная конфигурация базы данных для сервера
 * Поддерживает Firebase и PocketBase
 */

const provider = process.env.DB_PROVIDER || 'pocketbase';

let dbInstance = null;

/**
 * Инициализация соединения с БД
 * @returns {Promise<{db: object, admin: object|null, client: object|null}>}
 */
async function initializeDb() {
  if (dbInstance) return dbInstance;

  if (provider === 'firebase') {
    const admin = require('firebase-admin');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const keyFilePath = process.env.FIREBASE_KEY_FILE_PATH;

    try {
      if (keyFilePath) {
        admin.initializeApp({
          credential: admin.credential.cert(require(keyFilePath)),
        });
        console.log('✅ Firebase initialized with key file');
      } else if (projectId && clientEmail && privateKey && privateKey.includes('-----BEGIN')) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        console.log('✅ Firebase initialized with service account env vars');
      } else {
        admin.initializeApp();
        console.log('✅ Firebase initialized with Application Default Credentials');
      }

      dbInstance = {
        provider: 'firebase',
        db: admin.firestore(),
        admin,
        client: null,
      };
    } catch (error) {
      console.error('❌ Firebase initialization error:', error.message);
      throw error;
    }
  } else if (provider === 'pocketbase') {
    const PocketBase = require('pocketbase');
    const url = process.env.POCKETBASE_URL || 'http://localhost:8090';
    const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || '';

    try {
      const client = new PocketBase(url);

      // Авторизуемся как админ для серверных операций
      if (adminEmail && adminPassword) {
        await client.admins.authWithPassword(adminEmail, adminPassword);
        console.log('✅ PocketBase admin authenticated');
      } else {
        console.log('⚠️ PocketBase connected without admin auth');
      }

      dbInstance = {
        provider: 'pocketbase',
        db: null,
        admin: null,
        client,
      };
    } catch (error) {
      console.error('❌ PocketBase initialization error:', error.message);
      throw error;
    }
  } else {
    throw new Error(`Unknown DB provider: ${provider}`);
  }

  return dbInstance;
}

/**
 * Получить текущий инстанс БД
 */
function getDb() {
  return dbInstance;
}

module.exports = {
  initializeDb,
  getDb,
  provider,
};
