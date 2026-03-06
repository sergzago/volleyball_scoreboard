#!/usr/bin/env node

/**
 * Скрипт для проверки коллекции users в Firestore
 *
 * Использование:
 *   node scripts/check-firestore-users.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const KEY_FILE_PATH = process.env.FIREBASE_KEY_FILE_PATH || 
                      path.join(__dirname, '..', 'serviceAccountKey.json');

async function checkFirestoreUsers() {
  console.log('🏐 Volleyball Scoreboard - Проверка Firestore (users)\n');

  try {
    admin.initializeApp({
      credential: admin.credential.cert(require(KEY_FILE_PATH))
    });
    console.log('✅ Firebase Admin SDK инициализирован\n');
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error.message);
    process.exit(1);
  }

  const db = admin.firestore();

  try {
    const snapshot = await db.collection('users').get();
    
    console.log(`📊 Найдено документов в коллекции 'users': ${snapshot.size}\n`);
    
    if (snapshot.empty) {
      console.log('⚠️ Коллекция "users" пуста\n');
      console.log('💡 Это объясняет, почему admin.html не показывает пользователей!\n');
      console.log('Решение:');
      console.log('  1. Синхронизировать пользователей из Auth в Firestore');
      console.log('  2. Или изменить admin.html для загрузки из Auth API');
      return;
    }

    console.log('Документы:');
    console.log('─────────────────────────────────────────────────────────\n');
    
    snapshot.forEach(doc => {
      console.log(`📁 ID: ${doc.id}`);
      console.log(`   Данные:`, JSON.stringify(doc.data(), null, 2));
      console.log('─────────────────────────────────────────────────────────\n');
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkFirestoreUsers();
