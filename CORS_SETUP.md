# Настройка CORS для PocketBase

## Проблема

Запросы с `http://127.0.0.1:5500` к `http://zago.my.to:8090` блокируются политикой CORS браузера.

## Решение 1: Запуск PocketBase с разрешёнными origins (Рекомендуется)

### Если у вас есть доступ к серверу:

Остановите текущий процесс PocketBase и запустите с флагом `--origins`:

```bash
# Разрешить все origins (для разработки)
./pocketbase serve --http="0.0.0.0:8090" --origins="*"

# Или разрешить конкретные origins
./pocketbase serve --http="0.0.0.0:8090" \
  --origins="http://127.0.0.1:5500,http://localhost:5500,http://zago.my.to"
```

### Если PocketBase запущен как systemd service:

1. Откройте файл сервиса:
   ```bash
   sudo systemctl edit pocketbase
   ```

2. Добавьте:
   ```ini
   [Service]
   ExecStart=
   ExecStart=/path/to/pocketbase serve --http="0.0.0.0:8090" --origins="*"
   ```

3. Перезапустите:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart pocketbase
   ```

### Если PocketBase запущен через Docker:

```bash
docker run -p 8090:8090 \
  -v ./pb_data:/pb_data \
  ghcr.io/pocketbase/pocketbase \
  serve --http="0.0.0.0:8090" --origins="*"
```

## Решение 2: Настройка Nginx как reverse proxy с CORS

Если вы не можете изменить параметры запуска PocketBase, настройте Nginx:

```nginx
server {
    listen 80;
    server_name zago.my.to;

    location /api/ {
        # CORS заголовки
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        add_header 'Access-Control-Expose-Headers' 'Content-Disposition, Content-Length, X-Total-Count' always;
        
        # Обработка preflight запросов
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        # Проксирование к PocketBase
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Админ-панель тоже должна быть доступна
    location /_/ {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
        
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

После изменения конфигурации:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Решение 3: Временное отключение проверки CORS в браузере (только для разработки)

### Chrome:
```bash
google-chrome --disable-web-security --user-data-dir="/tmp/chrome-dev"
```

### Firefox:
В `about:config` установите:
```
security.fileuri.strict_origin_policy = false
```

**⚠️ Внимание:** Это отключает защиту CORS для всех сайтов. Используйте только для локальной разработки!

## Проверка

После настройки CORS выполните:

```bash
curl -H "Origin: http://127.0.0.1:5500" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS http://zago.my.to:8090/api/health -I
```

Должны появиться заголовки:
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Решение 4: Использование расширения браузера (для разработки)

Установите расширение для обхода CORS:
- Chrome: "Allow CORS: Access-Control-Allow-Origin"
- Firefox: "CORS Everywhere"

**⚠️ Используйте только для локальной разработки!**
