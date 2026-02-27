#!/usr/bin/env node

/**
 * Простой скрипт для настройки Firebase credentials
 * 
 * Использование:
 *   node scripts/setup-simple.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const KEY_FILE_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const ENV_FILE_PATH = path.join(__dirname, '..', '.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🏐 Volleyball Scoreboard - Firebase Setup');
  console.log('=========================================\n');

  // Проверка наличия ключа
  if (fs.existsSync(KEY_FILE_PATH)) {
    console.log(`✅ Service Account Key уже существует: ${KEY_FILE_PATH}`);
    const answer = await question('🔄 Пересоздать .env файл? (Y/n): ');
    if (answer.toLowerCase() !== 'n') {
      createEnvFile(KEY_FILE_PATH);
      console.log('\n✅ Готово! Запустите сервер: npm start');
    }
    rl.close();
    return;
  }

  console.log('📝 Для работы сервера нужен Service Account Key\n');
  console.log('Шаги для получения ключа:');
  console.log('');
  console.log('1. Откройте Firebase Console:');
  console.log('   https://console.firebase.google.com/project/myvolleyscore/settings/serviceaccounts/adminsdk');
  console.log('');
  console.log('2. Нажмите кнопку "Generate new private key"');
  console.log('');
  console.log('3. Сохраните скачанный JSON-файл');
  console.log('');
  console.log('4. Переименуйте файл в serviceAccountKey.json');
  console.log('   и поместите в папку server/');
  console.log('');
  
  const answer = await question('📁 Файл сохранён в server/serviceAccountKey.json? (y/N): ');
  
  if (answer.toLowerCase() === 'y') {
    if (fs.existsSync(KEY_FILE_PATH)) {
      console.log('✅ Ключ найден!');
      createEnvFile(KEY_FILE_PATH);
      console.log('\n✅ Готово! Запустите сервер: npm start');
    } else {
      console.log('❌ Файл не найден. Проверьте путь.');
    }
  } else {
    console.log('\n📝 Когда файл будет готов, запустите:');
    console.log('   node scripts/setup-simple.js');
  }

  rl.close();
}

function createEnvFile(keyPath) {
  const envContent = `# Firebase Admin SDK configuration
# Сгенерировано автоматически: ${new Date().toISOString()}

# Путь к файлу сервисного аккаунта
FIREBASE_KEY_FILE_PATH=${keyPath}

# Порт сервера
PORT=3000

# CORS разрешённые origin (опционально)
ALLOWED_ORIGINS=*
`;

  fs.writeFileSync(ENV_FILE_PATH, envContent);
  console.log(`✅ .env файл создан: ${ENV_FILE_PATH}`);
}

main().catch(console.error);
