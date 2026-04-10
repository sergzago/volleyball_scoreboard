# 🔐 Создание первого администратора

## Вход в систему

Для входа используется **имя пользователя (username)** или email.

**Формат входа:**
- **Username**: `admin` (или любое другое имя)
- **Email**: `admin@volleyball.local` (генерируется автоматически из username)
- **Пароль**: Минимум 8 символов

## Создание администратора

Управление пользователями осуществляется **через админ-панель провайдера**, а не через API:

### Способ 1: PocketBase Admin Dashboard

1. **Откройте админ-панель PocketBase**
   ```
   http://your-server:8090/_/
   ```

2. **Перейдите в коллекцию scoreusers**
   - Collections → `scoreusers`

3. **Создайте нового пользователя**
   - Нажмите "Create new record"
   - Заполните:
     ```
     username: admin
     email: admin@volleyball.local
     password: Admin@12345
     name: Администратор
     role: admin
     ```
   - Нажмите "Save"

4. **Проверьте вход**
   ```
   http://localhost:3000/login.html
   Username: admin
   Password: Admin@12345
   ```

### Способ 2: Firebase Console

1. **Откройте Firebase Console**
   ```
   https://console.firebase.google.com/project/YOUR_PROJECT/authentication
   ```

2. **Включите Email/Password провайдер** (если ещё не включён)
   - Sign-in method → Email/Password → Enable

3. **Создайте пользователя**
   - Users → Add user
   - Email: `admin@volleyball.local`
   - Password: `Admin@12345`

4. **Добавьте запись в Firestore**
   - Firestore Database → collection `users`
   - Create document с ID `admin`
   - Поля:
     ```json
     {
       "uid": "<UID из Firebase Auth>",
       "email": "admin@volleyball.local",
       "username": "admin",
       "displayName": "Администратор",
       "role": "admin",
       "createdAt": "<server timestamp>"
     }
     ```

## Проверка прав администратора

### Через API

```bash
# Войдите через login.html, получите токен
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
    "claims": { "role": "admin", "admin": true }
  }
}
```

### Через PocketBase Admin

```
http://your-server:8090/_/ → scoreusers → запись admin
Проверьте поле role = "admin"
```

### Через Firebase Console

```
Authentication → Users → admin@volleyball.local
Custom claims: {"admin": true, "role": "admin"}
```

## Устранение неполадок

| Ошибка | Причина | Решение |
|--------|---------|---------|
| Пользователь не найден | Нет записи в коллекции | Создайте через админ-панель провайдера |
| Неверный пароль | Пароль не совпадает | Сбросьте через админ-панель |
| Forbidden на admin.html | Роль не "admin" | Измените роль через провайдер |
| CORS (PocketBase) | Не настроены origins | `./pocketbase serve --origins="*"` |

## Примечания

- 🔒 **Не коммитьте пароли в git** — `credentials.js` добавлен в `.gitignore`
- 🔄 **Измените пароль после первого входа** в production
- 👥 **Управление пользователями** — только через Firebase Console или PocketBase Admin Dashboard
