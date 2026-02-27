#!/usr/bin/env node

/**
 * Скрипт для настройки Firebase credentials
 * 
 * Варианты использования:
 * 1. Автоматическая генерация Service Account Key через Firebase CLI
 * 2. Ручное создание JSON файла с ключом
 * 
 * Требования:
 * - Firebase CLI должен быть установлен: npm install -g firebase-tools
 * - Вы должны быть авторизованы: firebase login
 * - Вы должны иметь доступ к проекту myvolleyscore
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECT_ID = 'myvolleyscore';
const KEY_FILE_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const ENV_FILE_PATH = path.join(__dirname, '..', '.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Проверка наличия Firebase CLI
function checkFirebaseCLI() {
  try {
    execSync('firebase --version', { stdio: 'ignore' });
    console.log('✅ Firebase CLI найден');
    return true;
  } catch (error) {
    console.log('❌ Firebase CLI не найден');
    return false;
  }
}

// Установка Firebase CLI если нет
async function installFirebaseCLI() {
  console.log('📦 Установка Firebase CLI...');
  try {
    execSync('npm install -g firebase-tools', { stdio: 'inherit' });
    console.log('✅ Firebase CLI установлен');
    return true;
  } catch (error) {
    console.error('❌ Ошибка установки Firebase CLI');
    console.log('📝 Установите вручную: npm install -g firebase-tools');
    return false;
  }
}

// Авторизация в Firebase
async function firebaseLogin() {
  console.log('🔐 Авторизация в Firebase...');
  try {
    execSync('firebase login', { stdio: 'inherit' });
    console.log('✅ Авторизация успешна');
    return true;
  } catch (error) {
    console.error('❌ Ошибка авторизации');
    return false;
  }
}

// Генерация Service Account Key через Firebase CLI
function generateServiceAccountKey() {
  console.log('🔑 Генерация Service Account Key...');
  try {
    // Firebase CLI не имеет прямой команды для генерации ключа,
    // поэтому используем обходной путь через iam service-accounts keys create
    const serviceAccountEmail = `firebase-adminsdk-${PROJECT_ID}@${PROJECT_ID}.iam.gserviceaccount.com`;
    
    console.log(`📝 Проект: ${PROJECT_ID}`);
    console.log(`📝 Service Account: ${serviceAccountEmail}`);
    console.log('');
    console.log('⚠️  Для генерации ключа выполните команды вручную:');
    console.log('');
    console.log(`   gcloud config set project ${PROJECT_ID}`);
    console.log(`   gcloud iam service-accounts keys create ${KEY_FILE_PATH} \\`);
    console.log(`     --iam-account=${serviceAccountEmail}`);
    console.log('');
    
    return false;
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return false;
  }
}

// Создание .env файла
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

// Проверка существования ключа
function checkKeyFile() {
  if (fs.existsSync(KEY_FILE_PATH)) {
    console.log(`✅ Service Account Key найден: ${KEY_FILE_PATH}`);
    return true;
  }
  console.log(`❌ Service Account Key не найден: ${KEY_FILE_PATH}`);
  return false;
}

// Основная функция
async function main() {
  console.log('🏐 Volleyball Scoreboard - Firebase Setup');
  console.log('=========================================\n');

  // Проверка наличия ключа
  if (checkKeyFile()) {
    const answer = await question('⚠️  Ключ уже существует. Пересоздать? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      console.log('ℹ️  Используем существующий ключ');
      createEnvFile(KEY_FILE_PATH);
      rl.close();
      return;
    }
  }

  // Проверка Firebase CLI
  let hasFirebaseCLI = checkFirebaseCLI();
  
  if (!hasFirebaseCLI) {
    const answer = await question('📦 Установить Firebase CLI? (Y/n): ');
    if (answer.toLowerCase() !== 'n') {
      hasFirebaseCLI = await installFirebaseCLI();
    }
  }

  if (!hasFirebaseCLI) {
    console.log('\n❌ Не удалось установить Firebase CLI');
    console.log('\n📝 Альтернативный способ:');
    console.log('1. Откройте https://console.firebase.google.com/project/myvolleyscore/settings/serviceaccounts/adminsdk');
    console.log('2. Нажмите "Generate new private key"');
    console.log('3. Сохраните файл как serviceAccountKey.json в папке server/');
    rl.close();
    process.exit(1);
  }

  // Авторизация
  const loginAnswer = await question('🔐 Выполнить вход в Firebase? (Y/n): ');
  if (loginAnswer.toLowerCase() !== 'n') {
    await firebaseLogin();
  }

  // Генерация ключа через gcloud
  console.log('\n📝 Для генерации ключа требуется gcloud CLI');
  const gcloudAnswer = await question('🔑 Установить gcloud CLI и сгенерировать ключ? (Y/n): ');
  
  if (gcloudAnswer.toLowerCase() !== 'n') {
    try {
      // Проверка gcloud
      try {
        execSync('gcloud --version', { stdio: 'ignore' });
        console.log('✅ gcloud CLI найден');
      } catch (error) {
        console.log('❌ gcloud CLI не найден');
        console.log('📝 Установите: https://cloud.google.com/sdk/docs/install');
        console.log('');
        console.log('📝 Или создайте ключ вручную через Firebase Console:');
        console.log('   https://console.firebase.google.com/project/myvolleyscore/settings/serviceaccounts/adminsdk');
        rl.close();
        process.exit(1);
      }

      // Авторизация в gcloud
      console.log('🔐 Авторизация в gcloud...');
      execSync('gcloud auth login', { stdio: 'inherit' });
      
      // Установка проекта
      console.log(`📝 Установка проекта: ${PROJECT_ID}`);
      execSync(`gcloud config set project ${PROJECT_ID}`, { stdio: 'inherit' });
      
      // Генерация ключа
      console.log('🔑 Генерация Service Account Key...');
      const serviceAccountEmail = `firebase-adminsdk-${PROJECT_ID}@${PROJECT_ID}.iam.gserviceaccount.com`;
      execSync(
        `gcloud iam service-accounts keys create "${KEY_FILE_PATH}" --iam-account=${serviceAccountEmail}`,
        { stdio: 'inherit' }
      );
      
      console.log(`✅ Ключ создан: ${KEY_FILE_PATH}`);
      
      // Создание .env
      createEnvFile(KEY_FILE_PATH);
      
      console.log('\n=========================================');
      console.log('✅ Настройка завершена!');
      console.log('\n📝 Запуск сервера:');
      console.log('   cd server && npm start');
      
    } catch (error) {
      console.error('❌ Ошибка:', error.message);
    }
  } else {
    console.log('\n📝 Ручная настройка:');
    console.log('1. Откройте https://console.firebase.google.com/project/myvolleyscore/settings/serviceaccounts/adminsdk');
    console.log('2. Нажмите "Generate new private key"');
    console.log('3. Сохраните файл как serviceAccountKey.json в папке server/');
    console.log('4. Создайте .env файл:');
    console.log(`   FIREBASE_KEY_FILE_PATH=${KEY_FILE_PATH}`);
  }

  rl.close();
}

main().catch(console.error);
