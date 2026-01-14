# Copilot / AI agent instructions — Volleyball Scoreboard

Кратко: это небольшой статический проект (HTML/CSS/JS) для вывода табло волейбола. Состояние синхронизируется в реальном времени через Google Firestore. Основная задача AI-агента — вносить аккуратные изменения в UI и логику синхронизации, не ломая имён полей в БД.

- **Главные компоненты**
  - Генератор URL (создаёт `game` id): [index.html](index.html) — UI для создания пары URL: `scoreboard.html?game=...` и `ctl.html?game=...`.
  - Табло (показ, вставляется в OBS): [scoreboard.html](scoreboard.html) + [js/scoreboard.js](js/scoreboard.js)
  - Панель управления: [ctl.html](ctl.html) + [js/ctl.js](js/ctl.js)
  - Общая инициализация Firestore: [js/common.js](js/common.js)

- **Как это работает — высокоуровнево**
  - `js/common.js` читает параметр `game` из URL и создаёт `scoreboard_query = db.collection('volleyball').doc(game_id)`.
  - `scoreboard.js` и `ctl.js` подписываются на `scoreboard_query.onSnapshot(...)` для получения текущего состояния (`scoreboard_data`).
  - Панель управления обновляет документ через `scoreboard_query.update(data)` (функция `update_db` в `ctl.js`).
  - Отображение — простые DOM-замены jQuery: классы `.home_score`, `.away_score`, `.home_team` и т.д.

- **Ключевые поля Firestore (используются повсеместно)**
  - `home_team`, `away_team`, `home_score`, `away_score`, `home_color`, `away_color`
  - `current_period`, `show` (битовая маска: 1 — top, 2 — bottom, 4 — top label, 8 — сокрытие времени/нижних блоков и т.д.)
  - `beach_mode`, `home_sets`, `away_sets`, `set_history`, `pending_new_set`, `next_beach_set`, `beach_switch_message`
  - `home_side`, `away_side`, `invert_tablo`, `unlimited_score`

- **Проектные соглашения и паттерны**
  - Реальное состояние — единственный источник правды: документ Firestore `volleyball/<game_id>`.
  - Не переименовывать поля БД при правках UI; вместо этого добавляйте новые поля и аккуратно мигрируйте.
  - UI использует jQuery; изменения в DOM делайте в тех же местах (в `scoreboard.js`/`ctl.js`) чтобы избежать рассинхрона.
  - Логика отображения/правил (победы, смены площадок, режим пляжного волейбола) находится в `ctl.js` (много helper-функций — `isBeachMode`, `getBeachTarget`, `applyBeachSetWin` и т.д.).

- **Интеграции и внешние зависимости**
  - Firebase (скрипты: `js/firebase-app.js`, `js/firebase-firestore.js`) — используется публичный проект (конфиг в `js/common.js`).
  - UUID библиотека в `index.html` для генерации game id.
  - OBS: в README указано, что для вставки используется Browser Source размером `1000x550`.

- **Разработка и отладка (как быстро проверить изменения)**
  - Проект статический — запустите локальный сервер в корне проекта и откройте `index.html`:
    - Python: `python -m http.server 8000`
    - или: `npx http-server . -p 8000`
  - Сгенерируйте `game` через [index.html](index.html) либо откройте `scoreboard.html?game=test`/`ctl.html?game=test`.
  - Используйте DevTools для логов: `scoreboard.js` и `ctl.js` активно логируют состояние (`console.log(scoreboard_data)`).

- **Правила внесения изменений (обязательные)**
  - Любые изменения, меняющие структуру данных, должны сопровождаться: (1) добавлением чтения в `scoreboard.js`, (2) добавлением управления в `ctl.js`, (3) описанием миграции (если нужно) в коммите/PR.
  - Не удаляйте или не переименовывайте существующие поля Firestore без явной миграции.
  - Для визуальных изменений синхронизируйте CSS в `css/css.css` и `css/styles.css`.

- **Примеры конкретных задач и где править**
  - Добавить новое текстовое поле на табло: обновите `scoreboard.html` (DOM), добавьте рендер в `js/scoreboard.js` (чтение поля из `scoreboard_data`), и добавьте контрол в `ctl.html` + обработчик в `js/ctl.js` (вызов `update_db({ new_field: value })`).
  - Новая фича с флагом видимости: храните бит в `show` или добавьте булево поле; если добавляете булевое поле — обновите оба клиента.

Если нужно, переработаю или дополню этот файл примерами кода и списком всех полей с объяснениями. Напишите, какие части хотите уточнить.
