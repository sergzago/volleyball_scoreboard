# 🔐 Создание первого администратора

## Вход в систему

Теперь для входа используется **имя пользователя (username)** вместо email.

**Формат входа:**
- **Username**: `admin` (или любое другое имя)
- **Пароль**: Минимум 6 символов

Система автоматически генерирует внутренний email вида `username@volleyball.local` для совместимости с Firebase Authentication.

## Проблема

При запуске скрипта `create-admin-full.js` может возникать ошибка:
```
❌ Ошибка создания пользователя: There is no configuration corresponding to the provided identifier.
```

Это означает, что **Firebase Authentication не включен** в вашем Firebase проекте.

## Решение

### Способ 1: Через Firebase Console (рекомендуется)

1. **Откройте Firebase Console**
   - Перейдите на https://console.firebase.google.com/project/myvolleyscore/authentication

2. **Включите Firebase Authentication**
   - Нажмите "Get started" или "Начать"
   - Выберите вкладку "Sign-in method" (Метод входа)
   - Включите **Email/Password** провайдер
   - Нажмите "Save"

3. **Создайте пользователя**
   - Перейдите на вкладку "Users" (Пользователи)
   - Нажмите "Add user" (Добавить пользователя)
   - Введите:
     - **Email**: `admin@volleyball.local`
     - **Password**: `Admin@12345`
   - Нажмите "Add user"

4. **Добавьте пользователя в Firestore**
   - Перейдите в Firestore Database
   - Создайте коллекцию `users`
   - Добавьте документ с ID `admin` (нижний регистр)
   - Заполните поля:
     ```
     uid: [UID из Firebase Auth]
     email: admin@volleyball.local
     username: admin
     displayName: Администратор
     role: admin
     ```

### Способ 2: Через скрипт (если Authentication включен)

```bash
cd server
node scripts/create-admin-full.js admin Admin@12345 "Администратор"
```

**Ожидаемый вывод:**
```
🏐 Volleyball Scoreboard - Создание администратора

📁 Файл ключа: /path/to/serviceAccountKey.json
📝 Project ID: myvolleyscore

🔑 Инициализация Firebase Admin SDK...
✅ Firebase Admin SDK инициализирован

📝 Создание администратора...
   Username: admin
   Email: admin@volleyball.local
   Имя: Администратор
   Роль: ADMIN

👤 Создание пользователя в Firebase Auth...
✅ Пользователь создан: UID123456
🔧 Установка прав администратора (custom claims)...
✅ Права администратора установлены
📁 Сохранение пользователя в Firestore...
✅ Пользователь сохранен в Firestore

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Администратор успешно создан!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Username: admin
   Email: admin@volleyball.local
   UID: UID123456
   DisplayName: Администратор
   Role: admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Теперь вы можете войти на страницу:
   http://localhost:3000/login.html
   Username: admin
   Password: Admin@12345
```

### Способ 3: Через API сервера (альтернативный)

1. **Запустите сервер**
   ```bash
   cd server
   npm run dev
   ```

2. **Создайте пользователя через API** (требуется уже существующий админ)
   ```bash
   curl -X POST http://localhost:3000/api/auth/users \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -d '{
       "email": "admin@volleyball.local",
       "password": "Admin@12345",
       "displayName": "Администратор",
       "role": "admin"
     }'
   ```

## Проверка прав администратора

После создания пользователя проверьте его права:

1. **Через Firebase Console**
   - Откройте https://console.firebase.google.com/project/myvolleyscore/authentication/users
   - Найдите пользователя по email
   - Нажмите на него
   - В разделе "Custom claims" должно быть: `{"admin": true, "role": "admin"}`

2. **Через API**
   ```bash
   # Войдите через login.html и получите токен
   # Затем выполните запрос
   curl http://localhost:3000/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   
   Ожидаемый ответ:
   ```json
   {
     "user": {
       "uid": "...",
       "email": "admin@volleyball.local",
       "role": "admin",
       "claims": {
         "admin": true,
         "role": "admin"
       }
     }
   }
   ```

## Вход в систему

После создания администратора:

1. Откройте `http://localhost:3000/login.html`
2. Введите:
   - **Email**: `admin@volleyball.local`
   - **Пароль**: `Admin@12345`
3. Нажмите "Войти"
4. Должна произойти переадресация на `admin.html`

## Устранение неполадок

### Ошибка: "Firebase Admin SDK инициализирован", но создание не работает

**Проблема**: Firebase Authentication не включен в проекте

**Решение**:
1. Откройте Firebase Console
2. Перейдите в Authentication
3. Нажмите "Get started"
4. Включите Email/Password провайдер

### Ошибка: "PERMISSION_DENIED" или "403"

**Проблема**: У сервисного аккаунта нет прав на управление Authentication

**Решение**:
1. Откройте Firebase Console
2. Перейдите в Project Settings → Service Accounts
3. Убедитесь, что сервисный аккаунт имеет роль "Firebase Admin SDK"
4. При необходимости сгенерируйте новый ключ

### Ошибка: "email-already-in-use"

**Проблема**: Пользователь с таким email уже существует

**Решение**:
- Используйте другой email
- Или удалите существующего пользователя через Firebase Console

### Ошибка: "weak-password"

**Проблема**: Пароль слишком простой

**Решение**:
- Используйте пароль минимум из 6 символов
- Рекомендуется: буквы + цифры + спецсимволы

## Примечания

- **Храните credentials в безопасности**: Не коммитьте пароли в git
- **Измените пароль после первого входа**: В production используйте надежные пароли
- **Firebase Console**: https://console.firebase.google.com/project/myvolleyscore

## Быстрая проверка

```bash
# 1. Проверьте, что файл ключа существует
ls -la server/serviceAccountKey.json

# 2. Проверьте, что Authentication включен
# Откройте https://console.firebase.google.com/project/myvolleyscore/authentication

# 3. Запустите скрипт создания
cd server
node scripts/create-admin-full.js admin@example.com SecurePass123 "Admin"

# 4. Проверьте пользователя в Firebase Console
# https://console.firebase.google.com/project/myvolleyscore/authentication/users
```
