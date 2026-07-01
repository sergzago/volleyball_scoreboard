/**
 * Миграция паролей для Firebase
 *
 * Добавляет поле password (хешированное) к существующим пользователям в Firestore.
 *
 * Использование:
 *   # Задать один пароль всем пользователям без пароля:
 *   node server/scripts/migrate-passwords.js --password MySecure123
 *
 *   # Задать пароли из JSON-файла (username → password):
 *   node server/scripts/migrate-passwords.js --file passwords.json
 *
 *   # Показать только список пользователей без пароля (dry run):
 *   node server/scripts/migrate-passwords.js --dry-run
 *
 * Формат passwords.json:
 *   {
 *     "zago": "MyPassword123",
 *     "admin": "AdminPass456"
 *   }
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const SALT_LENGTH = 16;
const USERS_COLLECTION = process.env.FIREBASE_USERS_COLLECTION || 'users';

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return salt.toString('hex') + ':' + derived.toString('hex');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const passwordIdx = args.indexOf('--password');
  const fileIdx = args.indexOf('--file');

  let defaultPassword = null;
  let passwordMap = null;

  if (dryRun) {
    console.log('🔍 Режим dry run — пароли не будут записаны\n');
  } else if (passwordIdx !== -1 && args[passwordIdx + 1]) {
    defaultPassword = args[passwordIdx + 1];
    console.log(`🔑 Пароль для всех пользователей: ${'*'.repeat(defaultPassword.length)}\n`);
  } else if (fileIdx !== -1 && args[fileIdx + 1]) {
    const filePath = path.resolve(args[fileIdx + 1]);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Файл не найден: ${filePath}`);
      process.exit(1);
    }
    passwordMap = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`📄 Загружено ${Object.keys(passwordMap).length} паролей из ${filePath}\n`);
  } else {
    console.log('Использование:');
    console.log('  node server/scripts/migrate-passwords.js --password <пароль>');
    console.log('  node server/scripts/migrate-passwords.js --file <path/to/passwords.json>');
    console.log('  node server/scripts/migrate-passwords.js --dry-run');
    process.exit(1);
  }

  // Инициализация Firebase Admin SDK
  const admin = require('firebase-admin');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const keyFilePath = process.env.FIREBASE_KEY_FILE_PATH;

  if (keyFilePath) {
    admin.initializeApp({ credential: admin.credential.cert(require(keyFilePath)) });
    console.log('✅ Firebase initialized with key file');
  } else if (projectId && clientEmail && privateKey && privateKey.includes('-----BEGIN')) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase initialized with env vars');
  } else {
    const keyFile = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(keyFile)) {
      admin.initializeApp({ credential: admin.credential.cert(require(keyFile)) });
      console.log('✅ Firebase initialized with serviceAccountKey.json');
    } else {
      console.error('❌ Firebase credentials not found.');
      console.error('   Set FIREBASE_KEY_FILE_PATH or place serviceAccountKey.json in server/');
      process.exit(1);
    }
  }

  const db = admin.firestore();

  // Чтение всех пользователей
  const snapshot = await db.collection(USERS_COLLECTION).get();
  console.log(`📋 Всего пользователей: ${snapshot.size}\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const username = data.username || doc.id;

    if (data.password) {
      console.log(`  ⏭  ${username} — пароль уже есть, пропуск`);
      skipped++;
      continue;
    }

    let userPassword = null;
    if (passwordMap) {
      userPassword = passwordMap[username] || passwordMap[doc.id];
      if (!userPassword) {
        console.log(`  ⚠️  ${username} — пароль не найден в JSON, пропуск`);
        skipped++;
        continue;
      }
    } else {
      userPassword = defaultPassword;
    }

    if (dryRun) {
      console.log(`  🔍 ${username} — будет установлен пароль`);
      updated++;
      continue;
    }

    try {
      const hashed = hashPassword(userPassword);
      await db.collection(USERS_COLLECTION).doc(doc.id).update({ password: hashed });
      console.log(`  ✅ ${username} — пароль установлен`);
      updated++;
    } catch (err) {
      console.error(`  ❌ ${username} — ошибка: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Итого:`);
  console.log(`   Обновлено: ${updated}`);
  console.log(`   Пропущено: ${skipped}`);
  if (errors > 0) console.log(`   Ошибок: ${errors}`);
  if (dryRun) console.log(`\n⚠️  Это был dry run. Пароли не записаны. Уберите --dry-run для применения.`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
