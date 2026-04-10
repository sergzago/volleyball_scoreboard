# Система авторизации Volleyball Scoreboard

## Обзор

Система авторизации с поддержкой двух провайдеров (**Firebase** и **PocketBase**) и двух ролей:
- 👤 **Пользователь (user)** — базовый доступ к управлению табло и просмотру результатов
- 🔧 **Администратор (admin)** — полный доступ к админ-панели

## Компоненты системы

### Серверная часть (Express)

**Файлы:**
- `server/src/middleware/auth.js` — middleware для проверки авторизации и ролей
- `server/src/routes/auth.js` — API endpoints для аутентификации

**API Endpoints:**

| Метод | Endpoint | Описание | Доступ |
|-------|----------|----------|--------|
| `GET` | `/api/auth/me` | Информация о текущем пользователе | Auth |
| `POST` | `/api/auth/token` | Информация о текущем токене | Auth |

> **Управление пользователями** осуществляется через админ-панель провайдера:
> - **Firebase Console** → Authentication → Users
> - **PocketBase Admin Dashboard** → `http://your-server:8090/_/` → Collections → scoreusers

### Клиентская часть

**Файлы:**
- `login.html` — страница входа
- `admin.html` — админ-панель (просмотр пользователей и логов входа)
- `js/auth.js` — общий модуль авторизации
- `js/db-interface.js` — единый интерфейс работы с БД

## Провайдеры

Система поддерживает два провайдера, переключаемых через `DB_CONFIG.provider` (клиент) и `DB_PROVIDER` (сервер):

| Провайдер | Коллекция пользователей | Тип | Вход |
|---|---|---|---|
| **Firebase** | `users` (Firestore) | Firebase Auth | Email/Password |
| **PocketBase** | `scoreusers` | Auth collection | Username/Password или Email/Password |

## Быстрый старт

### 1. Создание первого администратора

Через админ-панель провайдера:

**Firebase:**
```
Firebase Console → Authentication → Users → Add user
Email: admin@volleyball.local
Password: Admin@12345

Затем в Firestore → users → документ "admin":
{
  "uid": "<UID>",
  "email": "admin@volleyball.local",
  "username": "admin",
  "displayName": "Администратор",
  "role": "admin"
}
```

**PocketBase:**
```
Откройте http://your-server:8090/_/
Collections → scoreusers → Create new record
username: admin
email: admin@volleyball.local
password: Admin@12345
role: admin
```

### 2. Запуск сервера

```bash
cd server
npm run dev
```

### 3. Вход в систему

1. Откройте `http://localhost:3000/login.html`
2. Введите **username** (или email) и пароль
3. После успешного входа:
   - **Администраторы** → перенаправляются на страницу с `?redirect=admin.html`
   - **Пользователи** → перенаправляются на `index.html`

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
    <script src="credentials.js"></script>
    <script src="js/db-config.js"></script>
    <script src="js/db-interface.js"></script>
    <script src="js/auth.js"></script>

    <script>
        window.addEventListener('DOMContentLoaded', async () => {
            const authorized = await AuthModule.checkAuth('user');
            if (!authorized) return;

            console.log('User role:', AuthModule.getCurrentRole());
        });
    </script>
</head>
<body>
    <button onclick="AuthModule.logout()">Выйти</button>
</body>
</html>
```

### Для страниц с доступом только для админов

```javascript
const authorized = await AuthModule.checkAuth('admin');
if (!authorized) return; // Перенаправление на ctl.html
```

## Ролевая модель

### Пользователь (user)
- ✅ Просмотр онлайн результатов (`online.html`)
- ✅ Управление табло (`ctl.html`)
- ✅ Создание игр (`index.html`)
- ✅ Изменение счёта и управление сетами

### Администратор (admin)
- ✅ Все права пользователя
- ✅ Админ-панель (`admin.html`) — просмотр пользователей и логов входа
- ✅ Управление пользователями через провайдер (Firebase Console / PocketBase Admin)

## Конфигурация

### Клиент (credentials.js)

```js
var CREDENTIALS = {
  firebase: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    // ...
  },
  pocketbase: {
    url: 'http://localhost:8090',
    user_email: 'app@example.com',
    user_password: 'app_password'
  }
};
```

### Сервер (.env)

```env
DB_PROVIDER=pocketbase  # или firebase

# Firebase
FIREBASE_PROJECT_ID=myvolleyscore
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# PocketBase
POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=admin@volleyball.local
POCKETBASE_ADMIN_PASSWORD=your_admin_password

PORT=3000
ALLOWED_ORIGINS=*
```

## Устранение неполадок

### Ошибка "Unauthorized" при запросах
- Проверьте срок действия токена
- Убедитесь, что токен передаётся в заголовке `Authorization: Bearer <token>`
- Проверьте, что пользователь существует

### Ошибка "Forbidden" на admin.html
- Убедитесь, что пользователь имеет роль `admin`
- Перезайдите в систему для обновления токена

### Ошибка CORS (PocketBase)
- Запустите PocketBase с флагом: `./pocketbase serve --http="0.0.0.0:8090" --origins="*"`
- Или настройте reverse proxy с CORS заголовками
