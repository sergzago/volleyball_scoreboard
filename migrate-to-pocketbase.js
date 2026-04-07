/**
 * Скрипт миграции данных из Firebase в PocketBase
 *
 * Переносит коллекции: volleyball, matches, users, auth_log
 * Настройки берутся из js/db-config.js
 *
 * Использование:
 *   node migrate-to-pocketbase.js
 */

const { DB_CONFIG, firebaseConfig, LOGO_BASE64 } = require('./js/db-config.js');

// Firebase Admin SDK (требуется сервисный аккаунт)
const admin = require('firebase-admin');

// PocketBase SDK
const PocketBase = require('pocketbase/cjs');

// Инициализация Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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
 * Авторизация в PocketBase как администратор
 */
async function authenticatePocketBase() {
  console.log('🔐 Авторизация в PocketBase...');
  try {
    await pb.admins.authWithPassword(
      DB_CONFIG.pocketbase.adminEmail,
      DB_CONFIG.pocketbase.adminPassword
    );
    console.log('✅ Авторизация успешна');
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error.message);
    process.exit(1);
  }
}

/**
 * Получение всех документов из коллекции Firebase
 */
async function getFirebaseCollection(collectionName) {
  console.log(`📥 Получение данных из Firebase: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const documents = [];
  
  snapshot.forEach(doc => {
    documents.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  console.log(`   Найдено документов: ${documents.length}`);
  return documents;
}

/**
 * Очистка данных от системных полей Firebase
 */
function cleanDocumentData(data) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (EXCLUDE_FIELDS.includes(key)) {
      continue;
    }
    
    // Преобразование Timestamp в ISO строку
    if (value && typeof value === 'object' && value.toDate) {
      cleaned[key] = value.toDate().toISOString();
    }
    // Рекурсивная очистка вложенных объектов
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = cleanDocumentData(value);
    }
    // Массивы
    else if (Array.isArray(value)) {
      cleaned[key] = value.map(item => 
        item && typeof item === 'object' ? cleanDocumentData(item) : item
      );
    }
    // Примитивы
    else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

/**
 * Создание записи в PocketBase
 */
async function createPocketBaseRecord(collectionName, data) {
  const { id, ...restData } = data;
  const cleanedData = cleanDocumentData(restData);
  
  try {
    // Попытка создать с тем же ID
    const record = await pb.collection(collectionName).create({
      id: id,
      ...cleanedData
    });
    return record;
  } catch (error) {
    // Если ID уже существует, создаем без указания ID
    if (error.status === 400 || error.message.includes('id')) {
      try {
        const record = await pb.collection(collectionName).create(cleanedData);
        return record;
      } catch (createError) {
        console.error(`   ⚠️  Ошибка создания записи: ${createError.message}`);
        return null;
      }
    }
    
    console.error(`   ⚠️  Ошибка: ${error.message}`);
    return null;
  }
}

/**
 * Миграция одной коллекции
 */
async function migrateCollection(collectionName) {
  const mapping = COLLECTION_MAP[collectionName];
  if (!mapping) {
    console.error(`❌ Коллекция ${collectionName} не найдена в карте миграции`);
    return { success: 0, failed: 0 };
  }
  
  const fbCollection = mapping.firebase;
  const pbCollection = mapping.pocketbase;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Миграция: ${collectionName}`);
  console.log(`   Firebase: ${fbCollection}`);
  console.log(`   PocketBase: ${pbCollection}`);
  console.log(`${'='.repeat(60)}`);
  
  // Получение данных из Firebase
  const documents = await getFirebaseCollection(fbCollection);
  
  if (documents.length === 0) {
    console.log('⏭️  Нет данных для миграции');
    return { success: 0, failed: 0 };
  }
  
  let successCount = 0;
  let failedCount = 0;
  
  // Миграция каждого документа
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const progress = `[${i + 1}/${documents.length}]`;
    
    process.stdout.write(`   ${progress} Миграция записи ${doc.id}... `);
    
    try {
      const record = await createPocketBaseRecord(pbCollection, doc);
      
      if (record) {
        console.log('✅');
        successCount++;
      } else {
        console.log('❌');
        failedCount++;
      }
    } catch (error) {
      console.log(`❌ ${error.message}`);
      failedCount++;
    }
  }
  
  console.log(`\n📊 Результаты миграции ${collectionName}:`);
  console.log(`   ✅ Успешно: ${successCount}`);
  console.log(`   ❌ Ошибки: ${failedCount}`);
  
  return { success: successCount, failed: failedCount };
}

/**
 * Миграция пользователей с паролями
 * Примечание: пароли Firebase не могут быть напрямую перенесены
 * Для пользователей будет сгенерирован временный пароль
 */
async function migrateUsersWithAuth() {
  const mapping = COLLECTION_MAP.users;
  const pbCollection = mapping.pocketbase;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔑 Миграция пользователей с авторизацией`);
  console.log(`${'='.repeat(60)}`);
  
  const fbCollection = mapping.firebase;
  const documents = await getFirebaseCollection(fbCollection);
  
  if (documents.length === 0) {
    console.log('⏭️  Нет пользователей для миграции');
    return { success: 0, failed: 0 };
  }
  
  let successCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const progress = `[${i + 1}/${documents.length}]`;
    
    process.stdout.write(`   ${progress} Миграция пользователя ${doc.id}... `);
    
    try {
      const { id, email, username, password, ...restData } = doc;
      const cleanedData = cleanDocumentData(restData);
      
      // PocketBase требует email для auth коллекций
      const userData = {
        id: id,
        email: email || `${username || id}@migrated.local`,
        username: username || `user_${id}`,
        password: password || 'TempPass123!', // Временный пароль
        passwordConfirm: password || 'TempPass123!',
        emailVisibility: true,
        verified: true,
        ...cleanedData
      };
      
      const record = await pb.collection(pbCollection).create(userData);
      console.log('✅');
      successCount++;
    } catch (error) {
      console.log(`❌ ${error.message}`);
      failedCount++;
    }
  }
  
  console.log(`\n📊 Результаты миграции пользователей:`);
  console.log(`   ✅ Успешно: ${successCount}`);
  console.log(`   ❌ Ошибки: ${failedCount}`);
  
  return { success: successCount, failed: failedCount };
}

/**
 * Основная функция миграции
 */
async function main() {
  console.log('🚀 Запуск миграции из Firebase в PocketBase');
  console.log(`📡 PocketBase URL: ${DB_CONFIG.pocketbase.url}`);
  console.log(`📦 Коллекции: ${Object.keys(COLLECTION_MAP).join(', ')}`);
  
  const startTime = Date.now();
  
  try {
    // Авторизация в PocketBase
    await authenticatePocketBase();
    
    const results = {};
    
    // Миграция обычных коллекций
    const collections = ['volleyball', 'matches', 'auth_log'];
    
    for (const collection of collections) {
      results[collection] = await migrateCollection(collection);
    }
    
    // Миграция пользователей (с обработкой auth)
    results.users = await migrateUsersWithAuth();
    
    // Итоговая статистика
    const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0);
    const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 Миграция завершена за ${elapsed}с`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Общая статистика:`);
    console.log(`   ✅ Успешно: ${totalSuccess}`);
    console.log(`   ❌ Ошибки: ${totalFailed}`);
    
    if (totalFailed > 0) {
      console.log(`\n⚠️  Некоторые записи не были мигрированы. Проверьте логи выше.`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n❌ Критическая ошибка: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Запуск
main().catch(console.error);
