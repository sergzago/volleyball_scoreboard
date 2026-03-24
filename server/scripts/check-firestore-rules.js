#!/usr/bin/env node

/**
 * Скрипт для проверки правил безопасности Firestore
 *
 * Использование:
 *   node scripts/check-firestore-rules.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { COLLECTIONS } = require('../../js/firebase-config');
require('dotenv').config();

const KEY_FILE_PATH = process.env.FIREBASE_KEY_FILE_PATH ||
                      path.join(__dirname, '..', 'serviceAccountKey.json');

async function checkFirestoreRules() {
  console.log('🏐 Volleyball Scoreboard - Проверка правил Firestore\n');

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
    // Тестовое чтение из коллекции users
    console.log('📝 Тест: Чтение коллекции users...\n');

    const snapshot = await db.collection(COLLECTIONS.USERS).get();
    console.log(`✅ Чтение успешно! Найдено документов: ${snapshot.size}\n`);

    // Тестовая запись
    console.log('📝 Тест: Запись тестового документа...\n');
    const testRef = db.collection(COLLECTIONS.USERS).doc('_test_rule_check');
    await testRef.set({
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Запись успешна!\n');
    
    // Удаляем тестовый документ
    await testRef.delete();
    console.log('✅ Тестовый документ удалён\n');
    
    console.log('─────────────────────────────────────────────────────────');
    console.log('Вывод: Правила Firestore разрешают чтение и запись');
    console.log('─────────────────────────────────────────────────────────\n');
    
    console.log('Если admin.html не работает, проверьте:');
    console.log('  1. Консоль браузера (F12) на наличие ошибок CORS или auth');
    console.log('  2. Что вы авторизованы как admin');
    console.log('  3. Правила безопасности в Firebase Console:');
    console.log('     https://console.firebase.google.com/project/myvolleyscore/firestore/rules');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    console.error('   Код ошибки:', error.code);
    process.exit(1);
  }
}

checkFirestoreRules();
