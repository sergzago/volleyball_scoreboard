/**
 * Универсальная конфигурация базы данных для сервера
 * Поддерживает Firebase и PocketBase
 */

// Приоритет: .env → db-config.js → pocketbase
let provider = process.env.DB_PROVIDER;
if (!provider) {
  try {
    const { DB_CONFIG } = require('../../../js/db-config');
    provider = DB_CONFIG.provider || 'pocketbase';
  } catch {
    provider = 'pocketbase';
  }
}

let dbInstance = null;

async function authenticateWithAppUser(client) {
  let userEmail, userPassword;
  try {
    const creds = require('../../../credentials.js');
    userEmail = creds.pocketbase?.user_email;
    userPassword = creds.pocketbase?.user_password;
  } catch {}

  if (userEmail && userPassword) {
    await client.collection('app_users').authWithPassword(userEmail, userPassword);
    console.log('✅ PocketBase authenticated as app_user');
  } else {
    console.log('⚠️ PocketBase connected without auth (no app_user credentials)');
  }
}

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
        // Fallback: ищем serviceAccountKey.json в корне проекта
        const fs = require('fs');
        const path = require('path');
        const keyFile = path.join(__dirname, '..', '..', '..', 'serviceAccountKey.json');
        if (fs.existsSync(keyFile)) {
          admin.initializeApp({
            credential: admin.credential.cert(require(keyFile)),
          });
          console.log('✅ Firebase initialized with serviceAccountKey.json');
        } else {
          admin.initializeApp();
          console.log('✅ Firebase initialized with Application Default Credentials');
        }
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
    const PocketBase = require('pocketbase').default;

    // Приоритет: .env → credentials.js → localhost:8090
    let url = process.env.POCKETBASE_URL;
    let adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
    let adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

    if (!url) {
      try {
        const creds = require('../../../credentials.js');
        if (creds.pocketbase && creds.pocketbase.url) {
          url = creds.pocketbase.url;
          console.log('ℹ️ PocketBase URL loaded from credentials.js');
        }
      } catch {}
    }

    url = url || 'http://localhost:8090';
    adminEmail = adminEmail || 'admin@example.com';
    adminPassword = adminPassword || '';

    try {
      const client = new PocketBase(url);

      // Авторизуемся как админ для серверных операций
      if (adminEmail && adminPassword) {
        try {
          await client.admins.authWithPassword(adminEmail, adminPassword);
          console.log('✅ PocketBase admin authenticated');
        } catch {
          console.log('⚠️ PocketBase admin auth failed, trying app_users...');
          await authenticateWithAppUser(client);
        }
      } else {
        await authenticateWithAppUser(client);
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
