# Тестирование системы авторизации

## Быстрый старт

### 1. Настройка Firebase credentials

Убедитесь, что у вас есть файл `serviceAccountKey.json` в папке `server/` или настроены переменные окружения.

**Вариант А: Файл ключа**
```bash
cd server
# Положите serviceAccountKey.json в папку server/
```

**Вариант Б: Переменные окружения**
```bash
cd server
cat > .env << EOF
FIREBASE_PROJECT_ID=myvolleyscore
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@myvolleyscore.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3000
EOF
```

### 2. Создание первого администратора

```bash
cd server
node scripts/create-admin.js admin@example.com Admin123456 "Admin User"
```

Ожидаемый вывод:
```
🏐 Volleyball Scoreboard - Создание администратора

✅ Firebase инициализирован с файлом ключа
✅ Firestore готов к работе

📝 Создание администратора...
   Email: admin@example.com
   Имя: Admin User
   Роль: ADMIN

✅ Пользователь создан: UID123456
✅ Права администратора установлены

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Администратор успешно создан!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UID: UID123456
   Email: admin@example.com
   DisplayName: Admin User
   Role: admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Запуск сервера

```bash
cd server
npm run dev
```

Ожидаемый вывод:
```
🏐 Volleyball Scoreboard API server running on port 3000
📊 Health check: http://localhost:3000/health
📋 API endpoints: ...
```

### 4. Проверка работы

#### Тест 1: Health check
```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:
```json
{"status":"ok","timestamp":"2026-03-05T..."}
```

#### Тест 2: Страница входа
1. Откройте `http://localhost:3000/login.html`
2. Должна отобразиться форма входа
3. Введите credentials администратора
4. Нажмите "Войти"
5. Должна произойти переадресация на `admin.html`

#### Тест 3: Админ-панель
1. Откройте `http://localhost:3000/admin.html`
2. Должна отобразиться панель управления пользователями
3. Попробуйте создать нового пользователя:
   - Email: `user@example.com`
   - Пароль: `User123456`
   - Роль: `user`
4. Новый пользователь должен появиться в списке

#### Тест 4: Страница управления табло
1. Откройте `http://localhost:3000/ctl.html`
2. Если не авторизованы → переадресация на `login.html`
3. После входа → отображается панель управления

#### Тест 5: Онлайн результаты
1. Откройте `http://localhost:3000/online.html`
2. Страница должна быть доступна без авторизации
3. В шапке должна быть кнопка "Войти"
4. После входа → отображается информация о пользователе

### 5. Тестирование API

#### Получить информацию о текущем пользователе

```bash
# Сначала получите токен через Firebase SDK (в браузере)
# Затем используйте в запросе
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

#### Список пользователей (только админ)

```bash
curl http://localhost:3000/api/auth/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Ожидаемый ответ:
```json
{
  "users": [
    {
      "uid": "...",
      "email": "admin@example.com",
      "displayName": "Admin User",
      "role": "admin",
      "createdAt": "...",
      "lastLoginAt": "..."
    },
    {
      "uid": "...",
      "email": "user@example.com",
      "displayName": "user",
      "role": "user",
      "createdAt": "...",
      "lastLoginAt": "..."
    }
  ]
}
```

#### Создать пользователя (только админ)

```bash
curl -X POST http://localhost:3000/api/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "displayName": "Test User",
    "role": "user"
  }'
```

#### Обновить пользователя (только админ)

```bash
curl -X PUT http://localhost:3000/api/auth/users/USER_UID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "displayName": "Updated Name",
    "role": "admin"
  }'
```

#### Удалить пользователя (только админ)

```bash
curl -X DELETE http://localhost:3000/api/auth/users/USER_UID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 6. Проверка безопасности

#### Тест: Доступ без авторизации
```bash
curl http://localhost:3000/api/auth/me
```

Ожидаемый ответ:
```json
{
  "error": "Unauthorized",
  "message": "Требуется авторизация. Пожалуйста, войдите в систему."
}
```

#### Тест: Доступ пользователя к админке
1. Войдите как пользователь с ролью `user`
2. Попробуйте открыть `admin.html`
3. Должна произойти переадресация на `ctl.html`

#### Тест: Неверный токен
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalid_token"
```

Ожидаемый ответ:
```json
{
  "error": "Unauthorized",
  "message": "Неверный или истекший токен авторизации."
}
```

### 7. Проверка ролевой модели

| Страница | Без авторизации | User | Admin |
|----------|----------------|------|-------|
| `login.html` | ✅ Доступно | ✅ Доступно | ✅ Доступно |
| `online.html` | ✅ Доступно | ✅ Доступно | ✅ Доступно |
| `ctl.html` | ❌ Redirect | ✅ Доступно | ✅ Доступно |
| `admin.html` | ❌ Redirect | ❌ Redirect | ✅ Доступно |
| `GET /api/auth/me` | ❌ 401 | ✅ 200 | ✅ 200 |
| `GET /api/auth/users` | ❌ 401 | ❌ 403 | ✅ 200 |

### 8. Возможные ошибки и решения

**Ошибка: "Firebase initialization error"**
- Проверьте наличие `serviceAccountKey.json`
- Проверьте переменные окружения в `.env`

**Ошибка: "Unauthorized" при входе**
- Проверьте, что пользователь существует в Firebase Console
- Проверьте правильность email/password

**Ошибка: "Forbidden" на admin.html**
- Убедитесь, что пользователь имеет роль `admin`
- Проверьте custom claims в Firebase Console

**Ошибка: CORS при запросах**
- Настройте `ALLOWED_ORIGINS` в `.env`
- Проверьте заголовки запросов

### 9. Очистка тестовых данных

Для удаления тестовых пользователей:

1. Откройте [Firebase Console](https://console.firebase.google.com/project/myvolleyscore/authentication/users)
2. Перейдите в раздел Authentication → Users
3. Удалите тестовых пользователей

Или через API (нужен админ токен):
```bash
curl -X DELETE http://localhost:3000/api/auth/users/USER_UID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Чек-лист успешного тестирования

- [ ] Сервер запускается без ошибок
- [ ] Health check возвращает 200 OK
- [ ] Страница входа отображается
- [ ] Вход с неверными данными показывает ошибку
- [ ] Вход администратора перенаправляет на admin.html
- [ ] Вход пользователя перенаправляет на ctl.html
- [ ] Создание пользователя работает
- [ ] Редактирование пользователя работает
- [ ] Удаление пользователя работает
- [ ] ctl.html требует авторизации
- [ ] admin.html требует прав администратора
- [ ] online.html доступна без авторизации
- [ ] Выход из системы работает
- [ ] API endpoints возвращают правильные ответы

## Дополнительные тесты

### Нагрузка
```bash
# 100 запросов к API
for i in {1..100}; do
  curl http://localhost:3000/api/auth/me \
    -H "Authorization: Bearer YOUR_TOKEN" &
done
wait
```

### Безопасность паролей
- [ ] Пароль < 6 символов отклоняется
- [ ] Специальные символы поддерживаются
- [ ] Unicode в паролях работает

### Сессионная модель
- [ ] Токен обновляется
- [ ] Выход из системы инвалидирует сессию
- [ ] Multiple devices работают корректно
