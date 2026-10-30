# Коллекции PocketBase — файлы для импорта

Каждую коллекцию можно импортировать отдельно через админ-панель PocketBase.

## Файлы

| Файл | Коллекция | Тип | Описание |
|------|-----------|-----|----------|
| `pb_collection_volleyball.json` | `volleyball` | base | Данные игровых табло |
| `pb_collection_matches.json` | `matches` | base | История матчей |
| `pb_collection_auth_log.json` | `auth_log` | base | Журнал авторизаций |
| `pb_collection_scoreusers.json` | `scoreusers` | **auth** | Пользователи (пароли хешируются) |
| `pb_collection_templates.json` | `templates1` | base | Шаблоны оформления |
| `pb_collection_tournaments.json` | `tournaments1` | base | Турниры (разделённые по типу: classic/beach) |
| `pb_collection_app_users.json` | `app_users` | **auth** | Сервисный аккаунт (app@volleyball.local) для админ-операций |

## Порядок импорта

1. Откройте `http://zago.my.to:8091/_/` (или `https://zago.my.to/pb/_/`)
2. Войдите как администратор PocketBase
3. **Settings → Import collections**
4. Вставьте содержимое JSON файла
5. Нажмите **Import**
6. Повторите для каждой коллекции

### Рекомендуемый порядок

1. **app_users** (сервисный аккаунт) — импортируйте первым
2. **scoreusers** (пользователи) — импортируйте вторым
3. **volleyball** (табло)
4. **matches** (матчи)
5. **auth_log** (журнал)
6. **templates1** (шаблоны)
7. **tournaments1** (турниры)

## Важно!

### Auth-коллекции

Коллекция `scoreusers` и `app_users` имеют тип **auth** — только в них пароли
хешируются автоматически (bcrypt).

Если коллекция `scoreusers` уже существует как **base** (не auth):
1. Удалите её: **Settings → Collections → scoreusers → Delete**
2. Импортируйте заново из `pb_collection_scoreusers.json`
3. Пересоздайте пользователей (пароли будут захешированы)

### Сервисный аккаунт (app_users)

Коллекция `app_users` используется сервисным клиентом (`getPocketBaseServiceClient()`
в `js/db-interface.js`) для создания/удаления пользователей и турниров.

После импорта `pb_collection_app_users.json`:
1. Создайте пользователя `app@volleyball.local` через админ-панель
2. Добавьте его учётные данные в `credentials.js`:

```js
pocketbase: {
  url: 'https://zago.my.to/pb/',
  user_email: 'app@volleyball.local',
  user_password: 'ВАШ_ПАРОЛЬ'
}
```

### Правила доступа

Все коллекции используют единый шаблон правил (см. `POCKETBASE_RULES.md`):
- `listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule` = `""`
  (любой авторизованный пользователь может выполнять любую операцию)
- Проверка прав администратора (`admin`/`user`) выполняется в коде приложения
  (`isCurrentUserAdmin()` в `mobile.js`, проверка роли в `admin.html`)

Если коллекция уже существует с неправильными правилами:
1. Удалите её: **Settings → Collections → <имя> → Delete**
2. Импортируйте заново из JSON-файла

### База знаний

- [POCKETBASE_RULES.md](POCKETBASE_RULES.md) — подробное описание правил доступа
