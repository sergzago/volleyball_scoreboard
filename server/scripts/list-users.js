#!/usr/bin/env node

/**
 * Скрипт для выгрузки списка пользователей из Firebase Authentication
 *
 * Использование:
 *   node scripts/list-users.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const KEY_FILE_PATH = process.env.FIREBASE_KEY_FILE_PATH || 
                      path.join(__dirname, '..', 'serviceAccountKey.json');

async function listUsers() {
  console.log('🏐 Volleyball Scoreboard - Список пользователей');
  console.log('===============================================\n');

  // Инициализация Firebase Admin SDK
  try {
    admin.initializeApp({
      credential: admin.credential.cert(require(KEY_FILE_PATH))
    });
    console.log('✅ Firebase Admin SDK инициализирован\n');
  } catch (error) {
    console.error('❌ Ошибка инициализации Firebase Admin SDK:');
    console.error('   Проверьте наличие и правильность файла serviceAccountKey.json');
    console.error('   Путь:', KEY_FILE_PATH);
    console.error('   Ошибка:', error.message);
    process.exit(1);
  }

  try {
    // Получаем всех пользователей из Firebase Authentication
    const listUsersResult = await admin.auth().listUsers();
    
    console.log(`📊 Найдено пользователей: ${listUsersResult.users.length}\n`);
    
    if (listUsersResult.users.length === 0) {
      console.log('⚠️ Пользователи не найдены в Firebase Authentication');
      return;
    }

    // Выводим таблицу пользователей
    console.log('┌──────┬─────────────────────────────┬──────────────────┬─────────────┬──────────┐');
    console.log('│  №   │ UID                         │ Email            │ DisplayName │ Роль     │');
    console.log('├──────┼─────────────────────────────┼──────────────────┼─────────────┼──────────┤');
    
    listUsersResult.users.forEach((userRecord, index) => {
      const uid = userRecord.uid.substring(0, 20) + '...';
      const email = userRecord.email || 'N/A';
      const displayName = userRecord.displayName || 'N/A';
      
      // Получаем роль из custom claims
      let role = 'user';
      if (userRecord.customClaims && userRecord.customClaims.admin) {
        role = 'admin';
      }
      
      console.log(`│ ${String(index + 1).padStart(4)} │ ${uid.padEnd(25)} │ ${email.padEnd(16)} │ ${displayName.padEnd(12)} │ ${role.padEnd(8)} │`);
    });
    
    console.log('└──────┴─────────────────────────────┴──────────────────┴─────────────┴──────────┘');
    
    // Экспорт в JSON (опционально)
    console.log('\n📄 JSON экспорт:');
    console.log(JSON.stringify(listUsersResult.users.map(userRecord => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      role: userRecord.customClaims?.admin ? 'admin' : 'user',
      createdAt: new Date(userRecord.metadata.creationTime).toISOString(),
      lastLoginAt: userRecord.metadata.lastSignInTime 
        ? new Date(userRecord.metadata.lastSignInTime).toISOString() 
        : null
    })), null, 2));

  } catch (error) {
    console.error('❌ Ошибка получения списка пользователей:', error.message);
    process.exit(1);
  }
}

listUsers();
