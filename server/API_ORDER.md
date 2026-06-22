# Порядок выполнения API функций

## 1. Авторизация

```
POST /api/auth/login
Body: { "identity": "admin", "password": "Admin@12345" }
→ Ответ: { "token": "eyJhbGciOi...", "user": { "uid": "...", "role": "admin" } }
```

Все последующие запросы требуют заголовок:
```
Authorization: Bearer <token>
```

### Проверка авторизации (опционально)

```
GET  /api/auth/me          → информация о текущем пользователе
POST /api/auth/token        → информация о токене
```

---

## 2. Создание матча (табло)

```
POST /api/scoreboard
Body: {
  "game_id": "match_001",
  "home_team": "Динамо",
  "away_team": "Зенит",
  "home_color": "#ff0000",
  "away_color": "#0000ff",
  "tournament_name": "НВЛ",
  "venue": "Спортзал Олимп"
}
→ 201: созданный объект табло
```

---

## 3. Настройка перед игрой

```
POST /api/scoreboard/{game_id}/teams      → задать/изменить команды
POST /api/scoreboard/{game_id}/label      → установить метку ("Разминка")
POST /api/scoreboard/{game_id}/display    → включить табло (show: 1)
POST /api/scoreboard/{game_id}/mode       → переключить режим (beach_mode: true/false)
PATCH /api/scoreboard/{game_id}/settings  → настройки (invert_tablo, two_wins_mode, unlimited_score)
```

---

## 4. Игровой процесс (повторяется)

### Начало сета
```
POST /api/scoreboard/{game_id}/period     → перейти к нужному периоду (delta: +1/-1)
```

### Игра идёт — начисление очков
```
POST /api/scoreboard/{game_id}/score
Body: { "team": "home", "delta": 1 }    → +1 очко
Body: { "team": "away", "delta": 1 }    → +1 очко
Body: { "team": "home", "delta": -1 }   → отменить очко
```

> При достижении условий победы в сете (25 очков с разницей ≥ 2, тай-брейк до 15)
> сервис автоматически фиксирует результат сета, обновляет `set_history`,
> выставляет `pending_new_set: true` и вычисляет `next_period`.

### Таймаут (управление через display/label)
```
POST /api/scoreboard/{game_id}/display   → show: 6 (верх надпись + низ)
POST /api/scoreboard/{game_id}/label     → custom_label: "Таймаут Динамо"
```

### Смена сторон (в тай-брейке при 8 очках)
```
POST /api/scoreboard/{game_id}/swap-sides
```

---

## 5. Новый сет (после завершения предыдущего)

```
POST /api/scoreboard/{game_id}/new-set
→ Сбрасывает счёт 0:0, применяет отложенную смену сторон/период
```

---

## 6. Завершение матча

Сервис автоматически определяет завершение матча при достижении нужного количества сетов:
- Классический: до 3 побед (5 сетов максимум)
- Пляжный: до 2 побед (3 сета максимум)
- До двух побед: до 2 побед (3 сета максимум)

После завершения — сохранить результат:
```
POST /api/matches
Body: {
  "game_id": "match_001",
  "setHistory": [{"home": 25, "away": 21}, {"home": 20, "away": 25}, {"home": 15, "away": 12}],
  "overallHome": 2,
  "overallAway": 1
}
→ 201: сохранённый результат
```

---

## 7. Просмотр результатов

```
GET /api/matches                              → список всех матчей
GET /api/matches?tournament=НВЛ               → фильтр по турниру
GET /api/matches?game_type=beach              → фильтр по типу
GET /api/matches?limit=10                     → лимит (1-200, по умолчанию 50)
GET /api/matches/{match_id}                   → детали конкретного матча
```

---

## 8. Сброс табло (новая игра)

```
POST /api/scoreboard/{game_id}/reset
Body: { "keep_settings": true }    → сохранить команды, турнир, цвета
Body: { "keep_settings": false }   → полный сброс
```

---

## Пример полного цикла (curl)

```bash
# 1. Логин
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identity":"admin","password":"Admin@12345"}' | jq -r '.token')

# 2. Создать матч
curl -X POST http://localhost:3000/api/scoreboard \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_id":"m1","home_team":"Динамо","away_team":"Зенит"}'

# 3. Настроить и включить табло
curl -X POST http://localhost:3000/api/scoreboard/m1/display \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"show":1}'

# 4. Играть — начислять очки
curl -X POST http://localhost:3000/api/scoreboard/m1/score \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"team":"home","delta":1}'

# 5. Новый сет (после завершения предыдущего)
curl -X POST http://localhost:3000/api/scoreboard/m1/new-set \
  -H "Authorization: Bearer $TOKEN"

# 6. Сохранить результат
curl -X POST http://localhost:3000/api/matches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_id":"m1","setHistory":[{"home":25,"away":21}],"overallHome":1,"overallAway":0}'

# 7. Посмотреть результаты
curl http://localhost:3000/api/matches \
  -H "Authorization: Bearer $TOKEN"
```

---

## Схема middleware

Каждый запрос проходит цепочку:

```
Request
  → helmet()              — безопасные HTTP-заголовки
  → cors()                — проверка origin
  → express.json()        — парсинг тела
  → requireAuth           — проверка Bearer-токена (scoreboard, matches)
  → validateXxx           — валидация параметров
  → route handler         — бизнес-логика (ScoreboardService)
  → errorHandler          — обработка ошибок
```
