/**
 * Отладочная версия скрипта миграции данных из Firebase в PocketBase
 */

const { DB_CONFIG, firebaseConfig, LOGO_BASE64 } = require('./js/db-config.js');

// Firebase Admin SDK
const admin = require('firebase-admin');

// PocketBase SDK
const PocketBase = require('pocketbase/cjs');

// Инициализация Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Инициализация PocketBase
const pb = new PocketBase(DB_CONFIG.pocketbase.url);

// Карта коллекций
const COLLECTION_MAP = {
  volleyball: {
    firebase: DB_CONFIG.firebaseCollections.VOLLEYBALL,
    pocketbase: DB_CONFIG.pocketbaseCollections.VOLLEYBALL
  },
  matches: {
    firebase: DB_CONFIG.firebaseCollections.MATCHES,
    pocketbase: DB_CONFIG.pocketbaseCollections.MATCHES
  },
  users: {
    firebase: DB_CONFIG.firebaseCollections.USERS,
    pocketbase: DB_CONFIG.pocketbaseCollections.USERS
  },
  auth_log: {
    firebase: DB_CONFIG.firebaseCollections.AUTH_LOG,
    pocketbase: DB_CONFIG.pocketbaseCollections.AUTH_LOG
  }
};

// Поля, которые нужно исключить из Firebase документов
const EXCLUDE_FIELDS = ['_firestore_deleted', 'created_at', 'updated_at'];

/**
 * Авторизация в PocketBase
 */
async function authenticatePocketBase() {
  console.log('🔐 Авторизация в PocketBase...');
  console.log('📧 Используем email:', DB_CONFIG.pocketbase.user_email);
  console.log('🌐 URL коллекции:', pb.collection('scoreusers').authWithPassword.toString());
  
  try {
    const authData = await pb.collection('scoreusers').authWithPassword(
      DB_CONFIG.pocketbase.user_email,
      DB_CONFIG.pocketbase.user_password
    );
    console.log('✅ Авторизация успешна');
    console.log('🔑 Токен:', authData.token.substring(0, 20) + '...');
    return true;
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error.message);
    console.error('🔍 Подробности:', error);
    return false;
  }
}

// Основная функция миграции (упрощенная для отладки)
async function main() {
  console.log('🚀 Запуск отладки миграции');
  console.log(`📡 PocketBase URL: ${DB_CONFIG.pocketbase.url}`);
  
  const success = await authenticatePocketBase();
  if (!success) {
    console.log('❌ Авторизация не удалась, проверьте учетные данные в credentials.js');
    process.exit(1);
  }
}

// Запуск
main().catch(console.error);