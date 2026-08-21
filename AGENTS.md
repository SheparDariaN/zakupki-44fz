# AGENTS.md — harness для агентов

Проект **Система обоснования НМЦК** (Fullstack Procurement Suite).
Веб-приложение для расчёта начальной (максимальной) цены контракта (44-ФЗ, метод анализа рынка) и генерации Word-документов: обоснование НМЦК и запрос коммерческого предложения.

Перед правками прочитай этот файл и карту ниже. Детали — в `docs/`. Правила стека — в `.cursor/rules/`.

## Карта репозитория

```
server.ts                 Express: API + Vite middleware (dev) / static SPA (prod)
src/server/db.ts          JSON-файл БД (SQL-подобный фасад get/all/run)
src/App.tsx               React Router: /login / /kp /admin /profile
src/types.ts              Общие типы AppState, KpDocxData
src/components/           Экраны UI (default export = имя файла)
src/utils/math.ts         Округление, среднее, СКО, CV, деньги
src/utils/numberToWords.ts Сумма прописью (рубли)
src/utils/docxGenerator.ts Обоснование НМЦК → DOCX (клиент)
src/utils/kpDocxGenerator.ts Запрос КП → DOCX/ZIP (клиент)
docs/                     Архитектура, API, предметная область
```

Не путать: `MainApp.tsx` экспортирует `function App()` — это калькулятор НМЦК, корневой роутер в `src/App.tsx`.

## Стек (как есть)

| Слой | Технологии |
|------|------------|
| UI | React 19, React Router 7, Tailwind CSS 4 (`@tailwindcss/vite`), lucide-react |
| Сборка | Vite 6, TypeScript 5.8 (`moduleResolution: bundler`), ESM |
| Сервер | Node 22, Express 4, `tsx` в dev, esbuild → `dist/server.cjs` в prod |
| Auth | JWT (24h) в `Authorization: Bearer`, bcryptjs, роль `admin`/`user` |
| Данные | JSON-файл (`DB_FILE` или `./database.json`), не SQLite |
| Документы | `docx` + `file-saver`; ZIP запросов КП через `jszip` |
| Деплой | Docker multi-stage, `docker-compose` порт 3000, volume `./data` |

Менеджер пакетов: **npm** (`package-lock.json`). Docker делает `npm ci`. `bun.lock` — артефакт AI Studio, не источник истины.

Неиспользуемые зависимости (не подключать без задачи): `@google/genai`, `motion`, `@types/better-sqlite3`.

## Команды

```bash
npm install          # зависимости (registry в .npmrc)
npm run dev          # tsx server.ts — API + Vite HMR, порт 3000
npm run build        # vite build + esbuild server.ts → dist/server.cjs
npm start            # node dist/server.cjs (нужен NODE_ENV=production)
npm run lint         # tsc --noEmit
docker compose up -d --build
```

Алиас `@/` указывает на **корень репозитория**, не на `src/`. Предпочитай относительные импорты как в текущем коде (`../types`, `./math`).

## Инварианты

1. UI и тексты документов — **русский**. Юридические формулировки 44-ФЗ / Приказ МЭР № 567 не перефразировать без явной просьбы.
2. Генерация DOCX только на клиенте. Сервер хранит JSON-снимок `state` в истории, не собирает Word.
3. История документов живёт 3 суток и чистится при `getDocuments`.
4. Дефолтный админ `admin`/`admin` создаётся при отсутствии пользователя — не хардкодить пароль в UI.
5. Секреты: `JWT_SECRET`, `GEMINI_API_KEY` только из env. Не коммитить `database.json`, `.env`, `data/`.
6. Новый API: маршрут в `server.ts`, данные через методы `JSONDatabase` (не новый SQL-диалект), JWT на всё кроме `/api/auth/login`.
7. Не раздувать стек (Redux, Prisma, SQLite), пока пользователь явно не попросил.

## Куда смотреть по задаче

| Задача | Файлы |
|--------|--------|
| Роут / экран | `src/App.tsx`, `src/components/*` |
| API / JWT | `server.ts` |
| Пользователи, настройки, история | `src/server/db.ts` |
| Формулы НМЦК | `src/utils/math.ts`, затем `MainApp.tsx` и `docxGenerator.ts` |
| Шаблон обоснования | `src/utils/docxGenerator.ts` |
| Шаблон запроса КП | `src/utils/kpDocxGenerator.ts`, превью `KpDocumentPreview.tsx` |
| Типы состояния | `src/types.ts` |
| Стили | `src/index.css` + Tailwind-классы в компонентах |
| Деплой | `Dockerfile`, `docker-compose.yml` |

Подробности: [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md), [docs/domain.md](docs/domain.md).
