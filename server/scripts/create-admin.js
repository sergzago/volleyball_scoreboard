/**
 * Скрипт для создания первого пользователя с правами администратора
 * Запускать через Node.js после настройки Firebase credentials
 *
 * Использование:
 * node scripts/create-admin.js email@example.com password
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Проверка аргументов командной строки
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('❌ Использование: node create-admin.js <email> <password> [displayName]');
    console.error('Пример: node create-admin.js admin@example.com MyPassword123 "Admin User"');
    process.exit(1);
}

const [email, password, displayName] = args;

// Инициализация Firebase Admin SDK
function initializeFirebase() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const keyFilePath = process.env.FIREBASE_KEY_FILE_PATH;

    try {
        // Вариант 1: Использовать JSON файл ключа
        if (keyFilePath) {
            console.log('📁 Используем файл ключа:', keyFilePath);
            admin.initializeApp({
                credential: admin.credential.cert(require(keyFilePath)),
            });
            console.log('✅ Firebase инициализирован с файлом ключа');
        }
        // Вариант 2: Использовать переменные окружения
        else if (projectId && clientEmail && privateKey && privateKey.includes('-----BEGIN')) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: privateKey.replace(/\\n/g, '\n'),
                }),
            });
            console.log('✅ Firebase инициализирован через переменные окружения');
        }
        // Вариант 3: Application Default Credentials
        else {
            admin.initializeApp();
            console.log('✅ Firebase инициализирован через Application Default Credentials');
        }

        console.log('✅ Firestore готов к работе');
        return true;
    } catch (error) {
        console.error('❌ Ошибка инициализации Firebase:', error.message);
        console.log('⚠️ Убедитесь, что файл .env настроен правильно');
        console.log('📝 Необходимые переменные:');
        console.log('   FIREBASE_KEY_FILE_PATH=path/to/serviceAccountKey.json');
        console.log('   или');
        console.log('   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        return false;
    }
}

// Создание администратора
async function createAdmin(email, password, displayName) {
    console.log('\n📝 Создание администратора...');
    console.log(`   Email: ${email}`);
    console.log(`   Имя: ${displayName || email.split('@')[0]}`);
    console.log('   Роль: ADMIN\n');

    try {
        // Создание пользователя в Firebase Auth
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: displayName || email.split('@')[0],
            emailVerified: false,
        });

        console.log('✅ Пользователь создан:', userRecord.uid);

        // Установка прав администратора через custom claims
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            role: 'admin',
            admin: true
        });

        console.log('✅ Права администратора установлены\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Администратор успешно создан!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Email: ${userRecord.email}`);
        console.log(`   DisplayName: ${userRecord.displayName}`);
        console.log(`   Role: admin`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('📝 Теперь вы можете войти на страницу:');
        console.log('   http://localhost:3000/login.html\n');

        return true;
    } catch (error) {
        console.error('\n❌ Ошибка создания пользователя:', error.message);
        
        if (error.code === 'auth/email-already-in-use') {
            console.error('   Пользователь с таким email уже существует');
        } else if (error.code === 'auth/weak-password') {
            console.error('   Слишком слабый пароль. Минимум 6 символов');
        } else if (error.code === 'auth/invalid-email') {
            console.error('   Неверный формат email');
        }

        return false;
    }
}

// Основная функция
async function main() {
    console.log('\n🏐 Volleyball Scoreboard - Создание администратора\n');
    
    if (!initializeFirebase()) {
        process.exit(1);
    }

    const success = await createAdmin(email, password, displayName);
    
    if (!success) {
        process.exit(1);
    }
}

// Запуск
main();
