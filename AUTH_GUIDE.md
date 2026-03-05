# Система авторизации Volleyball Scoreboard

## Обзор

Система авторизации на основе **Firebase Authentication** с поддержкой двух ролей:
- 👤 **Пользователь (user)** - базовый доступ к управлению табло и просмотру результатов
- 🔧 **Администратор (admin)** - полный доступ, включая управление пользователями

## Компоненты системы

### Серверная часть (Express + Firebase Admin SDK)

**Файлы:**
- `server/src/middleware/auth.js` - middleware для проверки авторизации и ролей
- `server/src/routes/auth.js` - API endpoints для аутентификации
- `server/scripts/create-admin.js` - скрипт создания первого администратора

**API Endpoints:**

| Метод | Endpoint | Описание | Доступ |
|-------|----------|----------|--------|
| `GET` | `/api/auth/me` | Информация о текущем пользователе | Auth |
| `POST` | `/api/auth/set-role` | Установить роль пользователя | Admin |
| `GET` | `/api/auth/users` | Список всех пользователей | Admin |
| `POST` | `/api/auth/users` | Создать нового пользователя | Admin |
| `PUT` | `/api/auth/users/:uid` | Обновить пользователя | Admin |
| `DELETE` | `/api/auth/users/:uid` | Удалить пользователя | Admin |

### Клиентская часть

**Файлы:**
- `login.html` - страница входа
- `admin.html` - админ-панель для управления пользователями
- `js/auth.js` - общий модуль авторизации

## Быстрый старт

### 1. Создание первого администратора

```bash
cd server

# Через Node.js
node scripts/create-admin.js admin@example.com YourPassword123 "Admin User"

# Или через API (если уже есть админ)
curl -X POST http://localhost:3000/api/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "admin@example.com",
    "password": "YourPassword123",
    "displayName": "Admin User",
    "role": "admin"
  }'
```

### 2. Запуск сервера

```bash
cd server
npm run dev
```

### 3. Вход в систему

1. Откройте `http://localhost:3000/login.html`
2. Введите email и пароль
3. После успешного входа:
   - **Администраторы** → перенаправляются на `admin.html`
   - **Пользователи** → перенаправляются на `ctl.html`

## Доступ к страницам

| Страница | Без авторизации | User | Admin |
|----------|----------------|------|-------|
| `index.html` | ❌ Prompt | ✅ Доступно | ✅ Доступно |
| `login.html` | ✅ Доступно | ✅ Доступно | ✅ Доступно |
| `online.html` | ✅ Доступно | ✅ Доступно | ✅ Доступно |
| `ctl.html` | ❌ Redirect | ✅ Доступно | ✅ Доступно |
| `admin.html` | ❌ Redirect | ❌ Redirect | ✅ Доступно |

## Интеграция с существующими страницами

### Подключение авторизации к странице

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Firebase SDK -->
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    
    <!-- Модуль авторизации -->
    <script src="js/auth.js"></script>
    
    <script>
        // Проверка авторизации при загрузке
        window.addEventListener('DOMContentLoaded', async () => {
            const authorized = await AuthModule.checkAuth('user');
            if (!authorized) {
                // Перенаправление на login.html выполнится автоматически
                return;
            }
            
            // Страница загружена и авторизована
            console.log('User role:', AuthModule.getCurrentRole());
        });
    </script>
</head>
<body>
    <!-- Контент страницы -->
    
    <button onclick="AuthModule.logout()">Выйти</button>
</body>
</html>
```

### Для страниц с доступом только для админов

```javascript
// Проверка прав администратора
const authorized = await AuthModule.checkAuth('admin');
if (!authorized) {
    // Пользователь будет перенаправлен на ctl.html
    return;
}
```

## Хранение паролей

Пароли хранятся в **Firebase Authentication** и хешируются автоматически с использованием алгоритма **bcrypt**. Firebase обеспечивает:

- ✅ Хеширование на стороне сервера
- ✅ Защита от brute-force атак
- ✅ Безопасное хранение в зашифрованном виде
- ✅ Соответствие стандартам безопасности

## Ролевая модель

### Пользователь (user)
- ✅ Просмотр онлайн результатов (`online.html`)
- ✅ Управление табло (`ctl.html`)
- ✅ Создание игр (`index.html`)
- ✅ Изменение счета
- ✅ Управление сетами

### Администратор (admin)
- ✅ Все права пользователя
- ✅ Управление пользователями (`admin.html`)
- ✅ Создание/редактирование/удаление пользователей
- ✅ Назначение ролей
- ✅ Просмотр статистики входов

## Безопасность

### Серверная защита
- Middleware `requireAuth` проверяет Firebase ID токен
- Middleware `requireAdmin` проверяет права администратора
- Custom claims хранятся в токене Firebase

### Клиентская защита
- Проверка авторизации при загрузке страницы
- Автоматическое перенаправление неавторизованных пользователей
- Токены обновляются через Firebase SDK

### Рекомендации
1. Используйте HTTPS в production
2. Настройте CORS для ограничения доменов
3. Регулярно обновляйте Firebase SDK
4. Используйте сложные пароли (минимум 6 символов)

## Конфигурация Firebase

Firebase конфигурация находится в файлах:
- `js/auth.js` - клиентская конфигурация
- `server/src/config/firebase.js` - серверная конфигурация

**Переменные окружения для сервера:**

```env
# .env файл в папке server/

# Вариант 1: Файл ключа
FIREBASE_KEY_FILE_PATH=./serviceAccountKey.json

# Вариант 2: Переменные окружения
FIREBASE_PROJECT_ID=myvolleyscore
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@myvolleyscore.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Порт сервера
PORT=3000

# Разрешенные CORS домены
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Устранение неполадок

### Ошибка "Firebase initialization error"
- Проверьте наличие файла `.env` в папке `server/`
- Убедитесь, что `serviceAccountKey.json` существует
- Проверьте переменные окружения

### Ошибка "Unauthorized" при запросах
- Проверьте срок действия токена
- Убедитесь, что токен передается в заголовке `Authorization: Bearer <token>`
- Проверьте, что пользователь существует в Firebase Auth

### Ошибка "Forbidden" на admin.html
- Убедитесь, что пользователь имеет роль `admin`
- Проверьте custom claims через Firebase Console
- Перезайдите в систему для обновления токена

## Миграция существующих пользователей

Если у вас уже есть пользователи в Firebase Auth без ролей:

```javascript
// Скрипт для установки роли существующему пользователю
const admin = require('firebase-admin');
admin.initializeApp();

async function setRole(uid, role) {
    await admin.auth().setCustomUserClaims(uid, {
        role: role,
        admin: role === 'admin'
    });
}

// Пример
setRole('USER_UID_HERE', 'admin');
```

## Дополнительные ресурсы

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
