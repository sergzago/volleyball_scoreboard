/**
 * Скрипт для создания первого пользователя с правами администратора
 * Использует Firebase Admin SDK напрямую с файлом ключа
 *
 * Использование:
 * node scripts/create-admin-full.js admin@example.com password [displayName]
 */

const admin = require('firebase-admin');
const path = require('path');
const { COLLECTIONS } = require('../../js/firebase-config');

// Проверка аргументов командной строки
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('❌ Использование: node create-admin-full.js <username> <password> [displayName]');
    console.error('Пример: node create-admin-full.js admin MyPassword123 "Администратор"');
    process.exit(1);
}

const [username, password, displayName] = args;

// Инициализация Firebase Admin SDK с файлом ключа
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

console.log('\n🏐 Volleyball Scoreboard - Создание администратора\n');
console.log('📁 Файл ключа:', serviceAccountPath);

try {
    const serviceAccount = require(serviceAccountPath);
    
    console.log('📝 Project ID:', serviceAccount.project_id);
    console.log('📝 Client Email:', serviceAccount.client_email);
    console.log('\n🔑 Инициализация Firebase Admin SDK...');
    
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key
        })
    });
    
    console.log('✅ Firebase Admin SDK инициализирован\n');
    
} catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error.message);
    console.log('\n📝 Убедитесь, что:');
    console.log('   1. Файл serviceAccountKey.json существует в папке server/');
    console.log('   2. Файл имеет правильную структуру JSON');
    console.log('   3. У сервисного аккаунта есть права на управление Firebase Authentication\n');
    process.exit(1);
}

// Создание администратора
async function createAdmin(username, password, displayName) {
    // Генерируем email из username
    const email = `${username.toLowerCase()}@volleyball.local`;
    displayName = displayName || username;
    
    console.log('📝 Создание администратора...');
    console.log('   Username:', username);
    console.log('   Email:', email);
    console.log('   Имя:', displayName);
    console.log('   Роль: ADMIN\n');

    try {
        // Создание пользователя в Firebase Auth
        console.log('👤 Создание пользователя в Firebase Auth...');
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: displayName,
            emailVerified: false,
        });

        console.log('✅ Пользователь создан:', userRecord.uid);

        // Установка прав администратора через custom claims
        console.log('🔧 Установка прав администратора (custom claims)...');
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            role: 'admin',
            admin: true
        });

        console.log('✅ Права администратора установлены\n');

        // Сохранение пользователя в Firestore с username
        console.log('📁 Сохранение пользователя в Firestore...');
        const db = admin.firestore();
        await db.collection(COLLECTIONS.USERS).doc(username.toLowerCase()).set({
            uid: userRecord.uid,
            email: email,
            username: username.toLowerCase(),
            displayName: displayName,
            role: 'admin',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLoginAt: null
        });
        console.log('✅ Пользователь сохранен в Firestore\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Администратор успешно создан!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   DisplayName: ${displayName}`);
        console.log(`   Role: admin`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('📝 Теперь вы можете войти на страницу:');
        console.log('   http://localhost:3000/login.html');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}\n`);

        return true;
    } catch (error) {
        console.error('\n❌ Ошибка создания пользователя:', error.message);
        
        if (error.code === 'auth/email-already-in-use') {
            console.error('   Пользователь с таким email уже существует');
        } else if (error.code === 'auth/weak-password') {
            console.error('   Слишком слабый пароль. Минимум 6 символов');
        } else if (error.code === 'auth/invalid-email') {
            console.error('   Неверный формат email');
        } else if (error.code.includes('UNAVAILABLE') || error.code.includes('ECONNREFUSED')) {
            console.error('   Нет доступа к Firebase API. Проверьте интернет-соединение.');
        } else if (error.code.includes('PERMISSION_DENIED') || error.code.includes('403')) {
            console.error('   Нет прав доступа. Проверьте права сервисного аккаунта.');
        }

        return false;
    }
}

// Основная функция
createAdmin(username, password, displayName)
    .then(success => {
        if (!success) {
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
