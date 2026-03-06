#!/usr/bin/env node

/**
 * Скрипт для проверки и установки custom claims
 *
 * Использование:
 *   node scripts/check-claims.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const KEY_FILE_PATH = process.env.FIREBASE_KEY_FILE_PATH || 
                      path.join(__dirname, '..', 'serviceAccountKey.json');

async function checkClaims() {
  console.log('🏐 Volleyball Scoreboard - Проверка Custom Claims\n');

  try {
    admin.initializeApp({
      credential: admin.credential.cert(require(KEY_FILE_PATH))
    });
    console.log('✅ Firebase Admin SDK инициализирован\n');
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error.message);
    process.exit(1);
  }

  try {
    // Получаем всех пользователей
    const listUsersResult = await admin.auth().listUsers();
    
    console.log(`📊 Найдено пользователей: ${listUsersResult.users.length}\n`);
    
    if (listUsersResult.users.length === 0) {
      console.log('⚠️ Пользователи не найдены');
      return;
    }

    for (const userRecord of listUsersResult.users) {
      console.log('─────────────────────────────────────────────────────────');
      console.log(`👤 Пользователь: ${userRecord.email}`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   DisplayName: ${userRecord.displayName || 'N/A'}`);
      
      const claims = userRecord.customClaims || {};
      console.log(`   Custom Claims:`, JSON.stringify(claims, null, 2));
      
      const hasAdminClaim = claims.admin === true;
      console.log(`   ✅ Admin claim: ${hasAdminClaim ? 'УСТАНОВЛЕН' : 'НЕ УСТАНОВЛЕН'}\n`);
      
      if (!hasAdminClaim) {
        console.log('   💡 Хотите установить admin claim? (y/N)');
        // Автоматически установим для всех пользователей
        console.log('   🔄 Устанавливаю admin claim...');
        await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
        console.log('   ✅ Admin claim установлен!\n');
      }
    }
    
    console.log('─────────────────────────────────────────────────────────');
    console.log('✅ Все пользователи теперь имеют admin claim');
    console.log('⚠️ Примечание: Токен обновится при следующем входе в систему');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('   Код:', error.code);
    process.exit(1);
  }
}

checkClaims();
