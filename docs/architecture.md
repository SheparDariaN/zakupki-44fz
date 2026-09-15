# Архитектура

Система обоснования НМЦК — монолитный fullstack: один Node-процесс отдаёт REST API и SPA. В development Express поднимает Vite в `middlewareMode`; в production раздаёт `dist/` и `index.html`.

## Процессы и сборка

| Режим | Команда | Что происходит |
|-------|---------|----------------|
| Dev | `npm run dev` → `tsx server.ts` | API + Vite HMR, порт 3000; нужны `DATABASE_URL` и `MONGODB_URI` |
| Migrations | `npm run migrate:up` / `npm run migrate:down` | PostgreSQL и MongoDB мигрируются явными `up` / `down` |
| Prod build | `npm run build` | `vite build` (SPA) + esbuild `server.ts` → `dist/server.cjs` |
| Prod run | `NODE_ENV=production npm start` | static `dist/` + API; `JWT_SECRET` обязателен |
| Docker | `docker compose up -d --build` | `app` (порт 3000), `postgres` и `mongo` только во внутренней сети, health `/api/health`, volume `./data/files` |
| Тесты | `npm test` | Vitest, формулы `math.ts` и `numberToWords.ts` |

`tsx` исполняет TypeScript на лету. Production-бандл сервера — CommonJS (`--format=cjs --packages=external`), внешние пакеты берутся из `node_modules`. Vite подключается только в dev через динамический `import("vite")`. `dotenv/config` читается в `server.ts` до `JWT_SECRET`.

Алиас Vite/TS `@/*` → корень репозитория. В коде фактически используются относительные пути.

## Слои

```
Браузер
  src/main.tsx → App.tsx (react-router-dom)
    AppShell: Закупки / Отчётность / Личный кабинет
    экраны: Login, Purchases, PurchaseDetail, MainApp, KpRequest, ServiceMemo, AdminPanel, Profile
    fetch /api/* + Authorization: Bearer
    docx / file-saver / jszip → скачивание .docx/.zip
        │
Express  server.ts
  JWT middleware, bcrypt, JSON/multipart limits
        │
        ├─ PostgreSQL: users, counterparties, purchases, purchase_links, purchase_documents
        ├─ MongoDB: document_states
        └─ File storage: contract.pdf / contract.docx на volume
```

Клиент не ходит в БД. Сервер не генерирует Word.

## Состояние UI

Закупка — контейнер для карточки, ссылок, документов и контракта. В PostgreSQL хранится владелец (`user_id`), название, цена, год лимитов, ссылки и метаданные документов. Доступ к закупке всегда проверяется по `req.user.id`.

`AppState` (калькулятор НМЦК): реквизиты, поставщики, позиции, матрица цен `positionId × supplierId`.

`KpDocxData` (запрос КП): адресаты, предмет, условия, сроки, контакты, должность и ФИО подписанта.

`ServiceMemoData` (служебная записка): цель, предмет, адресат шапки, составитель, руководитель контрактной службы, дата.

Вид JSON-документа задаёт `DocumentKind`: `nmck`, `kp`, `memo`. Клиентский реестр `src/documents/registry.ts` связывает вид с маршрутом внутри закупки, названием, генератором DOCX и декларативной схемой полей. Служебный `contract` используется только в API закупки и метаданных файлов, не в реестре клиентских генераторов.

## Данные

PostgreSQL — основной источник сущностей:

- `users`: логин, bcrypt hash, роль, флаг `must_change_password`, настройки профиля в `JSONB`;
- `counterparties`: общий справочник контрагентов для приложения;
- `purchases`: карточки закупок с владельцем, ценой и годом лимитов;
- `purchase_links`: URL площадок, каскадно удаляются вместе с закупкой;
- `purchase_documents`: метаданные документов закупки: `kind`, `storage`, `mongo_id` / `file_rel_path`, `mime`, `file_name`; уникальность `(purchase_id, kind)`.

MongoDB хранит коллекцию `document_states`: `{ purchaseId, kind, state, updatedAt }` с уникальным индексом `(purchaseId, kind)`. Сюда уходят снимки `AppState`, `KpDocxData`, `ServiceMemoData`; сгенерированные DOCX не сохраняются.

Файлы на volume используются только для контракта. Путь формируется сервером как `{FILE_STORAGE_DIR}/purchases/{id}/contract.{ext}`. Повторная загрузка удаляет предыдущий файл и обновляет метаданные в PostgreSQL.

Доступ к данным сейчас централизован в `src/server/db.ts` (`AppDatabase`) и storage-методах. SQL и MongoDB driver не должны растекаться по `server.ts`, UI или документным генераторам; `server.ts` остаётся границей HTTP.

## Auth

1. `POST /api/auth/login` → JWT 24h (`id`, `username`, `role`), в ответе `user` может быть `mustChangePassword`.
2. Клиент пишет `token` и `user` в `localStorage`.
3. `ProtectedRoute` проверяет наличие токена (не валидность) и отправляет пользователя с `mustChangePassword` в кабинет.
4. Админ-маршруты дополнительно проверяют `role === 'admin'`.

Секрет: `JWT_SECRET` из env (локально — `.env` через dotenv). В production без переменной процесс не стартует. В development, если env не задан, остаётся прежний fallback. Compose передаёт `JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET}`.

## HTTP-гигиена

SPA и API на одном origin: CORS не включаем. На ответах: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. В production для статики — CSP `default-src 'self'` (плюс `img-src data:`, `style-src 'unsafe-inline'`). Тело JSON ограничено лимитом снимка `state` (256 КБ + запас). Логин: не больше 10 неуспешных попыток с одного IP за 15 минут.

`GET /api/health` проверяет живые подключения к PostgreSQL и MongoDB и возвращает общий статус для Docker healthcheck.

## Границы интеграций

Архитектура держит минимальную поверхность атаки:

- сервер хранит JSON-состояния документов и не парсит пользовательские `.docx/.pdf`;
- контрактные файлы проверяются по расширению и magic bytes, но содержимое Office/PDF не интерпретируется;
- генерация DOCX выполняется только на клиенте;
- исходящие HTTP-запросы к внешним системам не используются.

Любая новая интеграция (импорт Excel, внешние API, SMTP/LDAP, HTML из внешних источников) оформляется отдельной задачей с ревью рисков по чеклисту в `.cursor/rules/security.mdc`.

## UI-конвенции

Brutalist paper: фон `#E4E3E0`, чернила `#141414`, Georgia/Courier точечно, кнопки `.btn-brutal`. Tailwind 4 без отдельного `tailwind.config`.

Общая оболочка `AppShell` ведёт в разделы «Закупки», «Отчётность», «Личный кабинет». Прямые маршруты документов (`/`, `/kp`, `/memo`) заменены вложенными маршрутами закупки: `/purchases/:id/nmck`, `/purchases/:id/kp`, `/purchases/:id/memo`.
