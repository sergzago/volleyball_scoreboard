#!/usr/bin/env node

/**
 * Диагностика Firebase для admin.html
 * 
 * Использование:
 *   node scripts/diagnose-firebase.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const KEY_FILE_PATH = process.env.FIREBASE_KEY_FILE_PATH || 
                      path.join(__dirname, '..', 'serviceAccountKey.json');

async function diagnose() {
  console.log('🏐 Volleyball Scoreboard - Диагностика Firebase\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Проверка ключа
  console.log('1️⃣ Проверка Service Account Key...');
  const fs = require('fs');
  if (!fs.existsSync(KEY_FILE_PATH)) {
    console.log(`   ❌ Файл не найден: ${KEY_FILE_PATH}`);
    process.exit(1);
  }
  console.log(`   ✅ Файл найден: ${KEY_FILE_PATH}`);
  
  let serviceAccount;
  try {
    serviceAccount = require(KEY_FILE_PATH);
    console.log(`   ✅ Project ID: ${serviceAccount.project_id}`);
    console.log(`   ✅ Client Email: ${serviceAccount.client_email}`);
  } catch (e) {
    console.log(`   ❌ Ошибка чтения ключа: ${e.message}`);
    process.exit(1);
  }

  // 2. Инициализация Admin SDK
  console.log('\n2️⃣ Инициализация Firebase Admin SDK...');
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('   ✅ Успешно');
  } catch (e) {
    console.log(`   ❌ Ошибка: ${e.message}`);
    process.exit(1);
  }

  const db = admin.firestore();

  // 3. Проверка пользователей Auth
  console.log('\n3️⃣ Пользователи Firebase Authentication...');
  try {
    const listUsersResult = await admin.auth().listUsers();
    console.log(`   ✅ Найдено: ${listUsersResult.users.length}`);
    
    for (const user of listUsersResult.users) {
      const hasAdmin = user.customClaims?.admin === true;
      console.log(`   • ${user.email} (${user.displayName || 'N/A'}) - ${hasAdmin ? '✅ ADMIN' : '⚠️ USER'}`);
    }
  } catch (e) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // 4. Проверка Firestore
  console.log('\n4️⃣ Коллекция Firestore "users"...');
  try {
    const snapshot = await db.collection('users').get();
    console.log(`   ✅ Найдено документов: ${snapshot.size}`);
    
    if (snapshot.empty) {
      console.log('   ⚠️ Коллекция пуста!');
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   • ${doc.id}: role=${data.role}, username=${data.username}`);
      });
    }
  } catch (e) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // 5. Синхронизация Auth ↔ Firestore
  console.log('\n5️⃣ Синхронизация Auth ↔ Firestore...');
  try {
    const listUsersResult = await admin.auth().listUsers();
    const snapshot = await db.collection('users').get();
    
    const authUids = new Set(listUsersResult.users.map(u => u.uid));
    const firestoreUids = new Set(snapshot.docs.map(d => d.data().uid));
    
    const inAuthNotFirestore = [...authUids].filter(uid => !firestoreUids.has(uid));
    const inFirestoreNotAuth = [...firestoreUids].filter(uid => !authUids.has(uid));
    
    if (inAuthNotFirestore.length === 0 && inFirestoreNotAuth.length === 0) {
      console.log('   ✅ Полная синхронизация');
    } else {
      if (inAuthNotFirestore.length > 0) {
        console.log(`   ⚠️ Есть в Auth, но нет в Firestore: ${inAuthNotFirestore.length}`);
      }
      if (inFirestoreNotAuth.length > 0) {
        console.log(`   ⚠️ Есть в Firestore, но нет в Auth: ${inFirestoreNotAuth.length}`);
      }
    }
  } catch (e) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // 6. Рекомендации
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📋 Рекомендации:\n');
  console.log('1. Откройте test-firestore.html в браузере');
  console.log('2. Войдите через login.html (test / <пароль>)');
  console.log('3. Проверьте консоль браузера (F12) на наличие ошибок');
  console.log('4. Если CORS ошибки - проверьте настройки Firebase Console');
  console.log('\n📁 Файлы для проверки:');
  console.log('   • test-firestore.html - тест подключения');
  console.log('   • admin.html - админ-панель');
  console.log('   • login.html - страница входа\n');
}

diagnose().catch(console.error);
