# Настройка сервера Volleyball Scoreboard API

## Быстрый старт

### 1. Установка зависимостей

```bash
cd server
npm install
```

### 2. Настройка Firebase

**Вариант А: Автоматическая настройка**
```bash
npm run setup
```

**Вариант Б: Вручную**

1. Откройте https://console.firebase.google.com/project/myvolleyscore/settings/serviceaccounts/adminsdk

2. Нажмите **"Generate new private key"**

3. Сохраните файл как `serviceAccountKey.json` в папке `server/`

4. Запустите:
   ```bash
   node scripts/setup-simple.js
   ```

### 3. Запуск сервера

```bash
# Development mode (с авто-перезагрузкой)
npm run dev

# Production mode
npm start
```

Сервер доступен на: http://localhost:3000

### 4. Проверка работы

```bash
curl http://localhost:3000/health
```

## API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `GET` | `/api/scoreboard/:game_id` | Получить состояние табло |
| `POST` | `/api/scoreboard/:game_id/score` | Изменить счёт (+1/-1) |
| `POST` | `/api/scoreboard/:game_id/new-set` | Новый сет |
| `POST` | `/api/scoreboard/:game_id/swap-sides` | Смена сторон |
| `POST` | `/api/scoreboard/:game_id/period` | Изменить период |
| `PUT` | `/api/scoreboard/:game_id/teams` | Обновить команды |
| `POST` | `/api/scoreboard/:game_id/reset` | Сброс табло |

Полная документация: [server/README.md](server/README.md)

## Примеры запросов

### Изменить счёт (добавить очко home)
```bash
curl -X POST http://localhost:3000/api/scoreboard/test1/score \
  -H "Content-Type: application/json" \
  -d '{"team": "home", "delta": 1}'
```

### Получить состояние табло
```bash
curl http://localhost:3000/api/scoreboard/test1
```

### Сбросить табло
```bash
curl -X POST http://localhost:3000/api/scoreboard/test1/reset \
  -H "Content-Type: application/json" \
  -d '{"keep_settings": true}'
```

---

## Структура проекта

```
server/
├── src/
│   ├── index.js              # Express сервер
│   ├── config/firebase.js    # Firebase конфигурация
│   ├── middleware/validators.js
│   ├── services/scoreboardService.js
│   └── routes/
│       ├── scoreboard.js
│       └── matches.js
├── scripts/
│   └── setup-simple.js       # Скрипт настройки
├── package.json
├── README.md
└── .env                      # Создаётся после настройки
```
