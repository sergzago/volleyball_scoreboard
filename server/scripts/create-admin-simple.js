/**
 * Скрипт для создания первого пользователя с правами администратора
 * Использует Firebase Identity Toolkit API напрямую
 *
 * Использование:
 * node scripts/create-admin.js email@example.com password [displayName]
 */

require('dotenv').config();
const https = require('https');

// Проверка аргументов командной строки
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('❌ Использование: node create-admin.js <email> <password> [displayName]');
    console.error('Пример: node create-admin.js admin@example.com MyPassword123 "Admin User"');
    process.exit(1);
}

const [email, password, displayName] = args;

// Чтение сервисного ключа
const keyFilePath = process.env.FIREBASE_KEY_FILE_PATH || './serviceAccountKey.json';
let serviceAccount;

try {
    serviceAccount = require(keyFilePath);
} catch (error) {
    console.error('❌ Ошибка чтения файла ключа:', error.message);
    console.log('📝 Убедитесь, что файл serviceAccountKey.json существует в папке server/');
    process.exit(1);
}

// Получение access токена через Google OAuth2
function getAccessToken() {
    return new Promise((resolve, reject) => {
        const jwt = require('jsonwebtoken');
        
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            sub: serviceAccount.client_email,
            aud: 'https://www.googleapis.com/oauth2/v4/token',
            iat: now,
            exp: now + 3600,
            scope: 'https://www.googleapis.com/auth/firebase'
        };

        const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });

        const data = JSON.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: token
        });

        const options = {
            hostname: 'www.googleapis.com',
            port: 443,
            path: '/oauth2/v4/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.access_token) {
                        resolve(result.access_token);
                    } else {
                        reject(new Error('Не удалось получить access token: ' + responseData));
                    }
                } catch (e) {
                    reject(new Error('Ошибка парсинга ответа: ' + responseData));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error('Ошибка запроса: ' + e.message));
        });

        req.write(data);
        req.end();
    });
}

// Создание пользователя через Firebase Identity Toolkit API
function createUser(accessToken, email, password, displayName) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            email: email,
            password: password,
            displayName: displayName || email.split('@')[0],
            emailVerified: false,
            disabled: false
        });

        const options = {
            hostname: 'identitytoolkit.googleapis.com',
            port: 443,
            path: '/v1/accounts:signUp?key=' + accessToken,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.error) {
                        reject(new Error(result.error.message));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(new Error('Ошибка парсинга ответа: ' + responseData));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error('Ошибка запроса: ' + e.message));
        });

        req.write(data);
        req.end();
    });
}

// Установка custom claims через Google Identity Toolkit API
function setCustomClaims(accessToken, uid, claims) {
    return new Promise((resolve, reject) => {
        // Для установки custom claims нужно использовать Admin SDK
        // Это упрощенная версия - в реальности нужно использовать Firebase Admin SDK
        console.log('⚠️ Установка custom claims требует Firebase Admin SDK');
        console.log('📝 UID пользователя:', uid);
        console.log('📝 Claims:', JSON.stringify(claims));
        resolve({ uid, claims });
    });
}

// Основная функция
async function main() {
    console.log('\n🏐 Volleyball Scoreboard - Создание администратора\n');
    console.log('📝 Email:', email);
    console.log('📝 Имя:', displayName || email.split('@')[0]);
    console.log('📝 Роль: ADMIN\n');

    try {
        console.log('🔑 Получение access токена...');
        const accessToken = await getAccessToken();
        console.log('✅ Токен получен\n');

        console.log('👤 Создание пользователя в Firebase Auth...');
        const user = await createUser(accessToken, email, password, displayName);
        console.log('✅ Пользователь создан\n');

        console.log('🔧 Установка прав администратора...');
        // Примечание: Для установки custom claims нужен Firebase Admin SDK
        // Этот скрипт создает пользователя, но права нужно установить через консоль Firebase
        console.log('⚠️ ВНИМАНИЕ: Для установки прав администратора используйте Firebase Console');
        console.log('   или установите Firebase Admin SDK и используйте create-admin-full.js\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Пользователь успешно создан!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Email: ${user.email}`);
        console.log(`   DisplayName: ${user.displayName}`);
        console.log(`   LocalId: ${user.localId}`);
        console.log('\n⚠️ Для установки прав администратора:');
        console.log('   1. Откройте Firebase Console');
        console.log('   2. Перейдите в Authentication → Users');
        console.log('   3. Найдите пользователя по email');
        console.log('   4. Установите custom claims: {"admin": true}\n');

    } catch (error) {
        console.error('\n❌ Ошибка:', error.message);
        process.exit(1);
    }
}

main();
