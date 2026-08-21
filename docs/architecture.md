# Архитектура

Система обоснования НМЦК — монолитный fullstack: один Node-процесс отдаёт REST API и SPA. В development Express поднимает Vite в `middlewareMode`; в production раздаёт `dist/` и `index.html`.

## Процессы и сборка

| Режим | Команда | Что происходит |
|-------|---------|----------------|
| Dev | `npm run dev` → `tsx server.ts` | API + Vite HMR, порт 3000 |
| Prod build | `npm run build` | `vite build` (SPA) + esbuild `server.ts` → `dist/server.cjs` |
| Prod run | `NODE_ENV=production npm start` | static `dist/` + API |
| Docker | `docker compose up -d --build` | image `nmck-app`, volume `./data` |

`tsx` исполняет TypeScript на лету. Production-бандл сервера — CommonJS (`--format=cjs --packages=external`), внешние пакеты берутся из `node_modules`.

Алиас Vite/TS `@/*` → корень репозитория. В коде фактически используются относительные пути.

## Слои

```
Браузер
  src/main.tsx → App.tsx (react-router-dom)
    экраны: Login, MainApp, KpRequest, AdminPanel, Profile
    fetch /api/* + Authorization: Bearer
    docx / file-saver / jszip  → скачивание .docx
        │
Express  server.ts
  JWT middleware, bcrypt
  JSONDatabase  src/server/db.ts  → файл DB_FILE
```

Клиент не ходит в БД. Сервер не генерирует Word.

## Состояние UI

`AppState` (калькулятор НМЦК): реквизиты, поставщики, позиции, матрица цен `positionId × supplierId`.

`KpDocxData` (запрос КП): адресаты, предмет, условия, сроки, контакты.

Снимок этого JSON сохраняется в `documents[].state` и позже позволяет пересобрать файл из личного кабинета.

## Данные

Файл JSON (не SQLite, несмотря на `@types/better-sqlite3` в devDependencies). Структура:

```json
{
  "users": [{ "id": 1, "username": "admin", "password": "<bcrypt>", "role": "admin", "settings": {} }],
  "documents": [{ "id": 1, "userId": 1, "name": "...", "type": "nmck", "state": {}, "createdAt": 0 }]
}
```

Путь: `DB_FILE` или `database.json` в cwd. Compose задаёт `/app/data/database.json`.

Методы `get` / `all` / `run` понимают только несколько захардкоженных SQL-строк для auth. Новые выборки — отдельные методы класса.

## Auth

1. `POST /api/auth/login` → JWT 24h (`id`, `username`, `role`).
2. Клиент пишет `token` и `user` в `localStorage`.
3. `ProtectedRoute` проверяет наличие токена (не валидность).
4. Админ-маршруты дополнительно проверяют `role === 'admin'`.

Секрет: `JWT_SECRET`. Fallback в коде слабый — в проде задавать через env.

## Зависимости, которые не используются

`@google/genai`, `motion`, `@types/better-sqlite3` — наследие шаблона AI Studio. Не импортировать «на всякий случай». `GEMINI_API_KEY` в `.env.example` к рантайму приложения не привязан.

## UI-конвенции

Brutalist paper: фон `#E4E3E0`, чернила `#141414`, Georgia/Courier точечно, кнопки `.btn-brutal`. Tailwind 4 без отдельного `tailwind.config`. Общая навигация НМЦК / Запрос КП — `AppNav`.
