# Тестирование системы авторизации

## Быстрый старт

### 1. Настройка credentials

Убедитесь, что файл `credentials.js` заполнен корректными данными (см. `credentials.example.js`).

**Для сервера** — файл `server/.env`:
```env
DB_PROVIDER=pocketbase  # или firebase

# PocketBase
POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=admin@volleyball.local
POCKETBASE_ADMIN_PASSWORD=your_admin_password

# Firebase (если DB_PROVIDER=firebase)
FIREBASE_PROJECT_ID=myvolleyscore
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

PORT=3000
ALLOWED_ORIGINS=*
```

### 2. Создание первого администратора

Через админ-панель провайдера:

**PocketBase:**
```
Откройте http://localhost:8090/_/
Collections → scoreusers → Create new record
username: admin
email: admin@volleyball.local
password: Admin123456
role: admin
```

**Firebase:**
```
Firebase Console → Authentication → Users → Add user
Email: admin@volleyball.local, Password: Admin123456

Firestore → users → документ "admin":
{ uid: "<UID>", email: "...", username: "admin", displayName: "Admin", role: "admin" }
```

### 3. Запуск сервера

```bash
cd server
npm run dev
```

### 4. Проверка работы

#### Тест 1: Health check
```bash
curl http://localhost:3000/health
```
Ожидаемый ответ: `{"status":"ok","provider":"pocketbase",...}`

#### Тест 2: Страница входа
1. Откройте `http://localhost:3000/login.html`
2. Введите username и пароль администратора
3. Должен произойти успешный вход

#### Тест 3: Админ-панель
1. Откройте `http://localhost:3000/admin.html` (с ?redirect=admin.html)
2. Должна отобразиться панель с списком пользователей

#### Тест 4: Страница управления табло
1. Откройте `http://localhost:3000/ctl.html`
2. Если не авторизованы → переадресация на `login.html`

#### Тест 5: Онлайн результаты
1. Откройте `http://localhost:3000/online.html`
2. Страница доступна без авторизации

### 5. Тестирование API

#### Получить информацию о текущем пользователе
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

Ожидаемый ответ:
```json
{
  "user": {
    "uid": "...",
    "email": "admin@volleyball.local",
    "role": "admin",
    "claims": { "role": "admin", "admin": true }
  }
}
```

### 6. Проверка безопасности

#### Тест: Доступ без авторизации
```bash
curl http://localhost:3000/api/auth/me
```
Ожидаемый ответ:
```json
{ "error": "Unauthorized", "message": "Требуется авторизация..." }
```

#### Тест: Доступ пользователя к админке
1. Войдите как пользователь с ролью `user`
2. Попробуйте открыть `admin.html` → переадресация на `ctl.html`

#### Тест: Неверный токен
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalid_token"
```
Ожидаемый ответ: `401 Unauthorized`

### 7. Проверка ролевой модели

| Страница | Без авторизации | User | Admin |
|----------|----------------|------|-------|
| `login.html` | ✅ | ✅ | ✅ |
| `online.html` | ✅ | ✅ | ✅ |
| `ctl.html` | ❌ Redirect | ✅ | ✅ |
| `admin.html` | ❌ Redirect | ❌ Redirect | ✅ |
| `GET /api/auth/me` | ❌ 401 | ✅ 200 | ✅ 200 |

### 8. Возможные ошибки и решения

| Ошибка | Решение |
|--------|---------|
| Firebase/PocketBase init error | Проверьте credentials и .env |
| Unauthorized при входе | Проверьте username/password в провайдере |
| Forbidden на admin.html | Проверьте роль пользователя, перезайдите |
| CORS (PocketBase) | Запустите с `--origins="*"` или настройте proxy |

## Чек-лист успешного тестирования

- [ ] Сервер запускается без ошибок
- [ ] Health check возвращает 200 OK
- [ ] Страница входа отображается
- [ ] Вход с неверными данными показывает ошибку
- [ ] Вход администратора работает
- [ ] Вход пользователя перенаправляет на index.html
- [ ] `ctl.html` требует авторизации
- [ ] `admin.html` требует прав администратора
- [ ] `online.html` доступна без авторизации
- [ ] Выход из системы работает
- [ ] API `/api/auth/me` возвращает данные пользователя
- [ ] API без токена возвращает 401
