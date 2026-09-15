# AGENTS.md — harness для агентов

Проект **Система обоснования НМЦК** (Fullstack Procurement Suite).
Веб-приложение для ведения закупок, расчёта начальной (максимальной) цены контракта (44-ФЗ, метод анализа рынка) и генерации Word-документов: обоснование НМЦК, запрос коммерческого предложения и служебная записка.

Перед правками прочитай этот файл и карту ниже. Детали — в `docs/`. Правила стека — в `.cursor/rules/`.

## Карта репозитория

```
server.ts                   Express: API + Vite middleware (dev) / static SPA (prod)
src/server/db.ts            AppDatabase: CRUD пользователей, закупок, документов, контрагентов
src/server/db/postgres.ts   PostgreSQL pool
src/server/db/mongo.ts      MongoDB client
src/server/storage/files.ts Файлы контрактов и входящих КП на volume
src/App.tsx                 React Router: /login /purchases /reports /cabinet /admin
src/types.ts                Общие типы AppState, KpDocxData, закупок и документов
src/components/             Экраны UI (default export = имя файла)
src/utils/math.ts           Округление, среднее, СКО, CV, деньги
src/utils/numberToWords.ts  Сумма прописью (рубли)
src/utils/docxGenerator.ts  Обоснование НМЦК → DOCX (клиент)
src/utils/kpDocxGenerator.ts Запрос КП → DOCX/ZIP (клиент)
docs/                       Архитектура, API, предметная область
```

Не путать: `MainApp.tsx` экспортирует `function App()` — это калькулятор НМЦК, корневой роутер в `src/App.tsx`.

## Стек (как есть)

| Слой | Технологии |
|------|------------|
| UI | React 19, React Router 7, Tailwind CSS 4 (`@tailwindcss/vite`), lucide-react |
| Сборка | Vite 6, TypeScript 5.8 (`moduleResolution: bundler`), ESM |
| Сервер | Node 22, Express 4, `tsx` в dev, esbuild → `dist/server.cjs` в prod |
| Auth | JWT (24h) в `Authorization: Bearer`, bcryptjs, роль `admin`/`user` |
| Данные | PostgreSQL (`pg`) для пользователей/закупок/справочников + MongoDB для JSON-состояний документов |
| Документы | `docx` + `file-saver`; ZIP запросов КП через `jszip`; контракт и входящие КП хранятся файлами на volume |
| Деплой | Docker multi-stage, `docker-compose` порт 3000, сервисы `app`/`postgres`/`mongo`, volume `./data/files` |

Менеджер пакетов: **npm** (`package-lock.json`). Docker делает `npm ci`. `bun.lock` — артефакт AI Studio, не источник истины. Не подключай Prisma, SQLite, `@google/genai`, `motion` без явной задачи.

## Команды

```bash
npm install          # зависимости (registry в .npmrc)
npm run dev          # tsx server.ts — API + Vite HMR, порт 3000
npm run build        # vite build + esbuild server.ts → dist/server.cjs
npm start            # node dist/server.cjs (нужен NODE_ENV=production и JWT_SECRET)
npm run lint         # tsc --noEmit
npm test             # vitest: math.ts, numberToWords
npm run audit        # npm audit --omit=dev (не блокирует релиз)
npm run migrate:up   # миграции PostgreSQL, затем MongoDB
npm run migrate:down # откат MongoDB, затем PostgreSQL
docker compose up -d --build  # нужны JWT_SECRET и переменные БД в .env
```

Алиас `@/` указывает на **корень репозитория**, не на `src/`. Предпочитай относительные импорты как в текущем коде (`../types`, `./math`).

## Инварианты

1. UI и тексты документов — **русский**. Юридические формулировки 44-ФЗ / Приказ МЭР № 567 не перефразировать без явной просьбы.
2. Генерация DOCX только на клиенте. Сервер хранит JSON-состояния документов в MongoDB и метаданные закупки в PostgreSQL, Word не собирает.
3. Документы принадлежат закупке и перезаписываются по паре `(purchase_id, kind)`; профиль хранит только настройки пользователя.
4. Дефолтный админ `admin`/`admin` создаётся при отсутствии пользователя — не хардкодить пароль в UI.
5. Секреты: `JWT_SECRET`, `DATABASE_URL`, `MONGODB_URI` только из env. В production `JWT_SECRET` обязателен. Не коммитить `.env`, дампы БД, `data/files`.
6. Новый API: маршрут в `server.ts`, данные через `AppDatabase` в `src/server/db.ts` и файловый storage, JWT на всё кроме `/api/auth/login` и `/api/health`.
7. Не раздувать стек (Redux, Prisma, SQLite, серверная генерация DOCX), пока пользователь явно не попросил.

## Куда смотреть по задаче

| Задача | Файлы |
|--------|--------|
| Роут / экран | `src/App.tsx`, `src/components/*` |
| API / JWT | `server.ts` |
| PostgreSQL / MongoDB CRUD | `src/server/db.ts` (`AppDatabase`), pool/client в `src/server/db/postgres.ts` и `src/server/db/mongo.ts` |
| Пользователи / закупки / ссылки / состояния документов | методы `AppDatabase` в `src/server/db.ts` |
| Контрактные файлы | `src/server/storage/files.ts` |
| Входящие КП | `src/components/PurchaseOffers.tsx`, `/api/purchases/:id/offers`, таблица `purchase_offers` |
| Формулы НМЦК | `src/utils/math.ts`, тесты `src/utils/*.test.ts`, затем `MainApp.tsx` и `docxGenerator.ts` |
| Шаблон обоснования | `src/utils/docxGenerator.ts` |
| Шаблон запроса КП | `src/utils/kpDocxGenerator.ts`, превью `KpDocumentPreview.tsx` |
| Типы состояния и закупок | `src/types.ts` |
| Стили | `src/index.css` + Tailwind-классы в компонентах |
| Деплой | `Dockerfile`, `docker-compose.yml`, миграции |

Подробности: [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md), [docs/domain.md](docs/domain.md).
