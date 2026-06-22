# Исправленные ошибки API сервера

Дата: 2026-06-22

## Критические

### 1. Уязвимость: отсутствие авторизации на маршрутах scoreboard/matches
**Файл:** `routes/scoreboard.js`, `routes/matches.js`
**Проблема:** Маршруты для чтения/записи данных табло и матчей не были защищены middleware `requireAuth`. Любой мог изменять счет без аутентификации.
**Исправление:** Добавлен `router.use(requireAuth)` в оба роутера.

### 2. Гонка токенов PocketBase auth middleware
**Файл:** `middleware/auth.js`
**Проблема:** `client.authStore.save(token, null)` мутировал общий authStore на глобальном инстансе PocketBase-клиента. При конкурентных запросах токены перезаписывали друг друга.
**Исправление:** Заменено на прямой декод JWT payload через `decodeJwtPayload()` без сохранения в authStore. Токен декодируется из base64url без обращения к серверу.

### 3. Краш error handler при null err.message
**Файл:** `middleware/validators.js`
**Проблема:** `err.message.startsWith(...)` выбрасывал `TypeError` если `err.message` был `null`/`undefined`, что приводило к падению процесса.
**Исправление:** Введена переменная `const msg = err.message || ''` с проверкой через неё.

## Логические ошибки

### 4. reset() скрывал табло вместо отображения
**Файл:** `services/scoreboardService.js`
**Проблема:** API-сброс ставил `show: 0` (табло скрыто), тогда как клиентский сброс (`ctl.js`) ставил `show: 1` (табло видно).
**Исправление:** Заменено на `show: 1`.

### 5. reset() не сбрасывал таймауты
**Файл:** `services/scoreboardService.js`
**Проблема:** `home_timeouts` и `away_timeouts` не обнулялись при сбросе, в отличие от клиентской версии.
**Исправление:** Добавлены `home_timeouts: 0, away_timeouts: 0`.

### 6. reset() терял поле venue
**Файл:** `services/scoreboardService.js`
**Проблема:** Поле `venue` полностью отсутствовало в `resetData`, хотя клиент его учитывал.
**Исправление:** Добавлено `venue: keepSettings ? data.venue : ''`.

### 7. reset() не сбрасывал unlimited_score
**Файл:** `services/scoreboardService.js`
**Исправление:** Добавлено `unlimited_score: false`.

### 8. updateScoreboard/updateLabel/updateDisplay без проверки существования
**Файл:** `services/scoreboardService.js`
**Проблема:** Методы вызывали `updateDoc` напрямую без проверки наличия документа. При несуществующем game_id клиент получал сырую ошибку БД вместо 404.
**Исправление:** Добавлен вызов `checkDb()` и проверка `getDoc()` перед обновлением.

### 9. _classicSetWon: запутанная логика для twoWinsMode
**Файл:** `services/scoreboardService.js`
**Проблема:** Тернарный оператор `twoWinsMode && period === 3 ? ... : (period === 5 ? 15 : ...)` работал случайно правильно, но был нечитаем и хрупок.
**Исправление:** Разделено на два явных ветвления: для `twoWinsMode` и для классического режима.

## Безопасность

### 10. PATCH /api/scoreboard/:game_id без фильтрации полей
**Файл:** `routes/scoreboard.js`
**Проблема:** Клиент мог напрямую установить `home_fouls`, `away_fouls`, `classic_match_finished` и другие внутренние поля, обходя бизнес-логику.
**Исправление:** Добавлен whitelist разрешённых полей.

### 11. Несанитизированный параметр limit
**Файл:** `routes/matches.js`
**Проблема:** `parseInt(limit)` при нечисловом значении возвращал `NaN`, который уходил в БД.
**Исправление:** `Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)`.

## Инфраструктурные

### 12. module.exports внутри .then() callback
**Файл:** `index.js`
**Проблема:** модуль экспортировался только после асинхронной инициализации БД. Тесты, делавшие `require()` до завершения, получали `undefined`.
**Исправление:** `module.exports = app` вынесен до вызова `initializeDb()`. Добавлен pre-init error handler.

## Не исправлено (требует отдельного решения)

- **Rate limiting на POST /api/auth/login** — требует добавления зависимости `express-rate-limit`.
- **PocketBase updateDoc: два отдельных вызова update** — обновление обычных и null-полей идёт разными запросами. Требует рефакторинга на транзакцию или batch API.
