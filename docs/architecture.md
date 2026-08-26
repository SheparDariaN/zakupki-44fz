# Архитектура

Система обоснования НМЦК — монолитный fullstack: один Node-процесс отдаёт REST API и SPA. В development Express поднимает Vite в `middlewareMode`; в production раздаёт `dist/` и `index.html`.

## Процессы и сборка

| Режим | Команда | Что происходит |
|-------|---------|----------------|
| Dev | `npm run dev` → `tsx server.ts` | API + Vite HMR, порт 3000 |
| Prod build | `npm run build` | `vite build` (SPA) + esbuild `server.ts` → `dist/server.cjs` |
| Prod run | `NODE_ENV=production npm start` | static `dist/` + API; `JWT_SECRET` обязателен |
| Docker | `docker compose up -d --build` | image `nmck-app`, volume `./data`, `USER node`, health `/api/health` |
| Тесты | `npm test` | Vitest, формулы `math.ts` и `numberToWords.ts` |

`tsx` исполняет TypeScript на лету. Production-бандл сервера — CommonJS (`--format=cjs --packages=external`), внешние пакеты берутся из `node_modules`. Vite подключается только в dev через динамический `import("vite")`. `dotenv/config` читается в `server.ts` до `JWT_SECRET`.

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

`KpDocxData` (запрос КП): адресаты, предмет, условия, сроки, контакты, должность и ФИО подписанта.

`ServiceMemoData` (служебная записка): цель, предмет, адресат шапки, составитель, руководитель контрактной службы, дата.

Вид документа задаёт общий `DocumentKind`: `nmck`, `kp`, `memo`. Клиентский реестр `src/documents/registry.ts` связывает вид с маршрутом, названием, генератором DOCX и именем записи истории. Снимок JSON сохраняется в `documents[].state` и позже позволяет пересобрать файл из личного кабинета.

## Данные

Файл JSON (не SQLite). Структура:

```json
{
  "users": [{ "id": 1, "username": "admin", "password": "<bcrypt>", "role": "admin", "settings": {} }],
  "documents": [{ "id": 1, "userId": 1, "name": "...", "type": "nmck", "state": {}, "createdAt": 0 }]
}
```

Путь: `DB_FILE` или `database.json` в cwd. Compose задаёт `/app/data/database.json`.

Выборки — явные методы класса (`getUserByUsername`, `createUser`, `addDocument`, …), не SQL-фасад. Запись на диск атомарная (temp-файл + `rename`) и только после мутации.

## Auth

1. `POST /api/auth/login` → JWT 24h (`id`, `username`, `role`), в ответе `user` может быть `mustChangePassword`.
2. Клиент пишет `token` и `user` в `localStorage`.
3. `ProtectedRoute` проверяет наличие токена (не валидность) и отправляет пользователя с `mustChangePassword` в профиль.
4. Админ-маршруты дополнительно проверяют `role === 'admin'`.

Секрет: `JWT_SECRET` из env (локально — `.env` через dotenv). В production без переменной процесс не стартует. В development, если env не задан, остаётся прежний fallback. Compose передаёт `JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET}`.

## HTTP-гигиена

SPA и API на одном origin: CORS не включаем. На ответах: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. В production для статики — CSP `default-src 'self'` (плюс `img-src data:`, `style-src 'unsafe-inline'`). Тело JSON ограничено лимитом снимка `state` (256 КБ + запас). Логин: не больше 10 неуспешных попыток с одного IP за 15 минут.

`npm run audit` (`--omit=dev`) смотрит high/critical; сборка Docker его не считает ошибкой.

## Границы интеграций

Архитектура держит минимальную поверхность атаки:

- сервер хранит JSON-снимки и не парсит пользовательские `.docx/.xlsx/.pdf/.zip`;
- генерация DOCX выполняется только на клиенте;
- исходящие HTTP-запросы к внешним системам не используются.

Любая новая интеграция (импорт файлов, внешние API, SMTP/LDAP, HTML из внешних источников) оформляется отдельной задачей с ревью рисков по чеклисту в `.cursor/rules/security.mdc`.

## UI-конвенции

Brutalist paper: фон `#E4E3E0`, чернила `#141414`, Georgia/Courier точечно, кнопки `.btn-brutal`. Tailwind 4 без отдельного `tailwind.config`. Общая навигация НМЦК / Запрос КП — `AppNav`.
