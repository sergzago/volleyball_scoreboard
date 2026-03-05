# 🔐 Авторизация на основе Firebase (без сервера)

## Обзор

Система авторизации полностью переработана для работы **только через Firebase SDK** без необходимости в серверном API.

## Как это работает

### Вход в систему

```
┌─────────────────────────────────────────────────────────┐
│ 1. Пользователь вводит username и пароль                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Генерируется email: username@volleyball.local        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Firebase Auth: signInWithEmailAndPassword()           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Получаем токен: user.getIdTokenResult()              │
│    Проверяем claims.admin                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Перенаправление:                                     │
│    - admin → admin.html                                 │
│    - user → ctl.html                                    │
└─────────────────────────────────────────────────────────┘
```

## Создание пользователей

### Способ 1: Через скрипт (рекомендуется для админов)

```bash
cd server
node scripts/create-admin-full.js username Password123 "Display Name"
```

Этот скрипт:
- ✅ Создает пользователя в Firebase Auth
- ✅ Устанавливает custom claims (роль admin/user)
- ✅ Сохраняет информацию в Firestore

### Способ 2: Через admin.html

1. Войдите как администратор
2. Откройте `admin.html`
3. Заполните форму:
   - **Имя пользователя**: `newuser`
   - **Пароль**: `Password123`
   - **Отображаемое имя**: `New User`
   - **Роль**: `user` или `admin`
4. Нажмите "Создать пользователя"

**Важно**: При создании через admin.html:
- ✅ Пользователь создается в Firebase Auth
- ✅ Информация сохраняется в Firestore
- ⚠️ Custom claims не устанавливаются (требуется Admin SDK)
- ⚠️ Для установки роли администратора используйте скрипт или Firebase Console

### Способ 3: Через Firebase Console

1. Откройте https://console.firebase.google.com/project/myvolleyscore/authentication/users
2. Нажмите "Add user"
3. Введите:
   - **Email**: `username@volleyball.local`
   - **Password**: `Password123`
4. После создания перейдите в Firestore
5. Создайте документ в коллекции `users`:
   - **Document ID**: `username` (в нижнем регистре)
   - **Поля**:
     ```
     uid: [UID пользователя]
     email: username@volleyball.local
     username: username
     displayName: Display Name
     role: admin или user
     ```

## Проверка прав администратора

### Через Firebase Console

1. Откройте https://console.firebase.google.com/project/myvolleyscore/authentication/users
2. Найдите пользователя по email
3. Нажмите на него
4. В разделе "Custom claims" должно быть:
   ```json
   {
     "admin": true,
     "role": "admin"
   }
   ```

### Через консоль браузера

```javascript
// В консоли на любой странице после входа
firebase.auth().currentUser.getIdTokenResult()
  .then(idTokenResult => {
    console.log('Claims:', idTokenResult.claims);
    console.log('Admin:', idTokenResult.claims.admin);
  });
```

## Быстрый старт

### 1. Создание первого администратора

```bash
cd server
node scripts/create-admin-full.js admin Admin@12345 "Администратор"
```

### 2. Вход

1. Откройте `http://localhost:3000/login.html`
2. Введите:
   - **Username**: `admin`
   - **Password**: `Admin@12345`
3. Нажмите "Войти"

### 3. Проверка

- Должна произойти переадресация на `admin.html`
- Вы увидите панель управления пользователями

## Управление пользователями

### Просмотр списка

Откройте `admin.html` → таблица пользователей загрузится из Firestore.

### Редактирование

1. Нажмите ✏️ рядом с пользователем
2. Измените данные
3. Нажмите "Сохранить"

**Примечание**: 
- ✅ displayName и role обновляются в Firestore
- ⚠️ Для смены пароля используйте Firebase Console

### Удаление

1. Нажмите 🗑️ рядом с пользователем
2. Подтвердите удаление

**Примечание**:
- ✅ Пользователь удаляется из Firestore
- ⚠️ Для полного удаления используйте Firebase Console

## Структура данных

### Firestore: коллекция `users`

```
users/
  ├── admin/
  │     ├── uid: "..."
  │     ├── email: "admin@volleyball.local"
  │     ├── username: "admin"
  │     ├── displayName: "Администратор"
  │     ├── role: "admin"
  │     ├── createdAt: Timestamp
  │     └── lastLoginAt: Timestamp
  │
  └── user1/
        ├── uid: "..."
        ├── email: "user1@volleyball.local"
        ├── username: "user1"
        ├── displayName: "User One"
        ├── role: "user"
        ├── createdAt: Timestamp
        └── lastLoginAt: Timestamp
```

### Firebase Authentication

Каждый пользователь имеет:
- **Email**: `username@volleyball.local`
- **Password**: (хешируется Firebase)
- **Custom claims**: `{ admin: true/false, role: "admin/user" }`

## Безопасность

### Правила безопасности Firestore

Рекомендуется настроить правила:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Коллекция users
    match /users/{userId} {
      // Чтение: только авторизованные пользователи
      allow read: if request.auth != null;
      
      // Создание: только авторизованные
      allow create: if request.auth != null;
      
      // Обновление: только админы или сам пользователь
      allow update: if request.auth != null && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         request.auth.uid == resource.data.uid);
      
      // Удаление: только админы
      allow delete: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Custom claims

- Устанавливаются только через Firebase Admin SDK
- Хранятся в ID токене
- Обновляются при следующем входе пользователя
- Нельзя изменить с клиента

## Преимущества архитектуры без сервера

✅ **Простота**: Не нужен backend для авторизации  
✅ **Безопасность**: Пароли хешируются Firebase  
✅ **Масштабируемость**: Firebase обрабатывает нагрузку  
✅ **Скорость**: Меньше задержек, нет промежуточных API  
✅ **Стоимость**: Бесплатно до определенных лимитов  

## Ограничения

⚠️ **Custom claims**: Установка только через Admin SDK (сервер или скрипт)  
⚠️ **Массовое управление**: Нет массовых операций через UI  
⚠️ **Аудит**: Нет детального логгирования действий  

## Troubleshooting

### Ошибка: "Пользователь не найден"

- Проверьте, что username введен правильно
- Убедитесь, что пользователь существует в Firebase Auth
- Проверьте консоль браузера на ошибки

### Ошибка: "Неверный пароль"

- Проверьте раскладку клавиатуры
- Убедитесь, что Caps Lock выключен
- Сбросьте пароль через Firebase Console

### Ошибка: "Доступ запрещен" на admin.html

- Проверьте, что пользователь имеет custom claim `admin: true`
- Используйте скрипт `create-admin-full.js` для установки прав
- Выйдите и войдите снова для обновления токена

### Пользователь создан, но не может войти

- Проверьте, что custom claims установлены
- Убедитесь, что email имеет формат `username@volleyball.local`
- Проверьте Firestore, что документ пользователя существует

## Миграция с серверной авторизации

Если у вас уже есть пользователи с серверной авторизацией:

1. Экспортируйте пользователей из базы данных
2. Импортируйте в Firebase Auth через Admin SDK
3. Установите custom claims через скрипт
4. Обновите клиенты на новую версию

## Дополнительные ресурсы

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
