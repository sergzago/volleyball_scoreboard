# Коллекции PocketBase — файлы для импорта

Каждую коллекцию можно импортировать отдельно через админ-панель PocketBase.

## Файлы

| Файл | Коллекция | Тип | Описание |
|------|-----------|-----|----------|
| `pb_collection_volleyball.json` | `volleyball` | base | Данные игровых табло |
| `pb_collection_matches.json` | `matches` | base | История матчей |
| `pb_collection_auth_log.json` | `auth_log` | base | Журнал авторизаций |
| `pb_collection_scoreusers.json` | `scoreusers` | **auth** | Пользователи (пароли хешируются) |

## Порядок импорта

1. Откройте `http://zago.my.to:8090/_/`
2. Войдите как администратор
3. **Settings → Import collections**
4. Вставьте содержимое JSON файла
5. Нажмите **Import**
6. Повторите для каждой коллекции

### Рекомендуемый порядок

1. **scoreusers** (пользователи) — импортируйте первым
2. **volleyball** (табло)
3. **matches** (матчи)
4. **auth_log** (журнал)

## Важно!

Коллекция `scoreusers` имеет тип **auth** — только в ней пароли хешируются автоматически (bcrypt).

Если коллекция `scoreusers` уже существует как **base** (не auth):
1. Удалите её: **Settings → Collections → scoreusers → Delete**
2. Импортируйте заново из `pb_collection_scoreusers.json`
3. Пересоздайте пользователей (пароли будут захешированы)
