const admin = require('firebase-admin');

let db = null;
let adminInstance = null;

// Инициализация Firebase Admin SDK
function initializeFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const keyFilePath = process.env.FIREBASE_KEY_FILE_PATH;

  try {
    // Вариант 1: Использовать JSON файл ключа сервисного аккаунта
    if (keyFilePath) {
      admin.initializeApp({
        credential: admin.credential.cert(require(keyFilePath)),
      });
      console.log('✅ Firebase initialized with key file');
    }
    // Вариант 2: Использовать переменные окружения
    else if (projectId && clientEmail && privateKey && privateKey.includes('-----BEGIN')) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase initialized with service account env vars');
    }
    // Вариант 3: Application Default Credentials
    else {
      admin.initializeApp();
      console.log('✅ Firebase initialized with Application Default Credentials');
    }
    
    db = admin.firestore();
    console.log('✅ Firestore ready');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.log('⚠️ Running without Firebase credentials. API will return errors for database operations.');
    console.log('📝 Set FIREBASE_KEY_FILE_PATH or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in .env');
  }

  return { admin, db };
}

module.exports = { initializeFirebase };
