# Изменения в системе авторизации PocketBase

## Что изменено

### 1. Авторизация через настраиваемую коллекцию

**До:** Авторизация происходила через встроенную коллекцию PocketBase `'users'`.

**После:** Авторизация происходит через настраиваемую коллекцию, указанную в `DB_CONFIG.collections.USERS` (по умолчанию: `scoreusers`).

### 2. Хеширование паролей

Пароли хранятся в **зашифрованном виде** автоматически — PocketBase использует bcrypt для хеширования паролей в auth коллекциях. Это встроенная функция PocketBase, не требующая дополнительного кода.

### 3. Все обращения к коллекции пользователей

Все вызовы `pb.collection('users')` заменены на `pb.collection(DB_CONFIG.collections.USERS)`:

| Функция | Было | Стало |
|---------|------|-------|
| `auth.login()` | `pb.collection('users').authWithPassword()` | `pb.collection(DB_CONFIG.collections.USERS).authWithPassword()` |
| `auth.createUser()` | `pb.collection('users').create()` | `pb.collection(DB_CONFIG.collections.USERS).create()` |
| `auth.deleteUser()` | `pb.collection('users').delete()` | `pb.collection(DB_CONFIG.collections.USERS).delete()` |
| `auth.getUserRole()` | `pb.collection('users').getFirstListItem()` | `pb.collection(DB_CONFIG.collections.USERS).getFirstListItem()` |
| `users.get()` | `pb.collection('users').getFirstListItem()` | `pb.collection(DB_CONFIG.collections.USERS).getFirstListItem()` |
| `users.update()` | `pb.collection('users').update()` | `pb.collection(DB_CONFIG.collections.USERS).update()` |
| `users.delete()` | `pb.collection('users').delete()` | `pb.collection(DB_CONFIG.collections.USERS).delete()` |

## Конфигурация

В `js/db-config.js`:

```javascript
pocketbaseCollections: {
  VOLLEYBALL: 'volleyball',
  MATCHES: 'matches',
  USERS: 'scoreusers',  // ← Настраиваемая коллекция для авторизации
  AUTH_LOG: 'auth_log'
}
```

## Структура коллекции `scoreusers`

### Тип
**Auth** — это специальный тип коллекции в PocketBase, который:
- Автоматически хеширует пароли (bcrypt)
- Поддерживает авторизацию по username/email
- Управляет сессиями пользователей
- Поддерживает OAuth2 провайдеры

### Поля

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `username` | Text | ✅ | Уникальное имя пользователя (3-50 символов) |
| `email` | Email | ✅ | Email адрес (уникальный) |
| `name` | Text | ❌ | Отображаое имя |
| `role` | Select | ❌ | Роль: `admin`, `user`, `moderator` |
| `avatar` | File | ❌ | Аватар пользователя |

### Настройки аутентификации

```json
{
  "allowEmailAuth": true,
  "allowOAuth2Auth": true,
  "allowUsernameAuth": true,
  "minPasswordLength": 8,
  "requireEmail": false,
  "onlyVerified": false
}
```

## Как это работает

### 1. Вход пользователя

```javascript
DB.auth.login('admin', 'password123').then(function(userInfo) {
  console.log(userInfo.username); // 'admin'
  console.log(userInfo.role);     // 'admin'
});
```

**Процесс:**
1. `DB.auth.login()` вызывает `pb.collection('scoreusers').authWithPassword(username, password)`
2. PocketBase находит пользователя в коллекции `scoreusers`
3. Сравнивает хеш пароля с помощью bcrypt
4. Если совпадает — создаёт сессию и возвращает данные
5. Если не совпадает — пробует авторизацию по email

### 2. Создание пользователя

```javascript
DB.auth.createUser('newuser', 'password123', 'New User', 'user')
```

**Процесс:**
1. Авторизуемся как админ PocketBase
2. Вызываем `pb.collection('scoreusers').create({...})`
3. PocketBase автоматически:
   - Хеширует пароль (bcrypt)
   - Проверяет уникальность username и email
   - Создаёт запись в коллекции

### 3. Проверка сессии

```javascript
DB.auth.onAuthStateChanged(function(user) {
  if (user) {
    console.log('Авторизован:', user.username);
  }
});
```

**Процесс:**
1. Проверяет `pb.authStore.isValid`
2. Если сессия валидна — возвращает данные из `pb.authStore.model`

## Создание коллекции `scoreusers`

### Способ 1: Импорт JSON

1. Откройте `http://zago.my.to:8090/_/`
2. Войдите как администратор
3. **Settings → Import collections**
4. Вставьте содержимое `pocketbase_collections_export.json`

### Способ 2: Через скрипт

```bash
cd server
node scripts/create-collections.js
```

### Способ 3: Вручную

См. `SETUP_COLLECTIONS.md`

## Безопасность

### Хеширование паролей

- **Алгоритм:** bcrypt (встроен в PocketBase)
- **Соль:** Автоматически генерируется для каждого пользователя
- **Стоимость:** Настраивается в PocketBase (по умолчанию: 10)
- **Хранение:** В базе хранится только хеш, никогда plaintext

### Правила доступа (API Rules)

| Операция | Правило | Описание |
|----------|---------|----------|
| List | `id = @request.auth.id` | Пользователь видит только свою запись |
| View | `id = @request.auth.id` | Пользователь видит только свою запись |
| Create | `` (пусто) | Любой может создать (через API) |
| Update | `id = @request.auth.id` | Пользователь меняет только свою запись |
| Delete | `role = "admin"` | Только админ может удалять |

## Миграция с встроенной `users`

Если у вас уже есть пользователи во встроенной коллекции `users`:

1. Экспортируйте пользователей из `_superusers`
2. Создайте коллекцию `scoreusers`
3. Импортируйте пользователей в `scoreusers`
4. Измените `DB_CONFIG.collections.USERS` на `'scoreusers'`
5. Перезагрузите приложение

## Отладка

### Включить логирование

В консоли браузера:
```javascript
localStorage.setItem('debug', 'pocketbase:*');
```

### Проверить коллекцию

```javascript
DB.init().then(function() {
  var pb = new PocketBase(DB_CONFIG.pocketbase.url);
  pb.collections.getList().then(function(collections) {
    console.log('Коллекции:', collections.map(c => c.name));
  });
});
```

### Проверить авторизацию

```javascript
DB.auth.login('admin', 'password').then(console.log).catch(console.error);
```
