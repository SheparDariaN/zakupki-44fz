# Система обоснования НМЦК

Веб-приложение для ведения закупок, расчёта начальной (максимальной) цены контракта (анализ рынка, 44-ФЗ) и генерации Word-документов: обоснование НМЦК, запрос коммерческого предложения и служебная записка. Есть вход по логину, роли, личный кабинет и панель администратора.

Документация для разработки: [docs/architecture.md](docs/architecture.md) · [docs/api.md](docs/api.md) · [docs/domain.md](docs/domain.md). Для агентов: [AGENTS.md](AGENTS.md).

## Стек

| Слой | Технологии |
|------|------------|
| Frontend | React 19, React Router 7, Vite 6, TypeScript, Tailwind CSS 4, lucide-react |
| Backend | Node.js 22, Express 4, JWT, bcryptjs |
| Данные | PostgreSQL (`pg`) для пользователей/закупок/справочников + MongoDB для JSON-состояний документов |
| Документы | `docx`, `file-saver`, `jszip` (генерация в браузере); контракт хранится файлом на volume |
| Деплой | Docker (multi-stage), docker compose, порт 3000, сервисы `app`/`postgres`/`mongo` |

Пакеты ставятся через **npm** (`package-lock.json`).

## Запуск

### Docker (сервер)

Скопируйте `.env.example` в `.env` и задайте `JWT_SECRET` — Compose без него не поднимется.

```bash
cp .env.example .env   # затем замените JWT_SECRET
docker compose up -d --build
```

Приложение: `http://localhost:3000`. Проверка: `GET /api/health`. PostgreSQL и MongoDB доступны только внутри сети Compose (порты на хост не публикуются). Данные лежат в именованных Docker volumes, контракты — в `./data/files`.

### Без Docker

Нужен Node.js 22 и локальные PostgreSQL и MongoDB (Compose БД с хоста недоступны). Затем примените миграции:

```bash
npm install
npm run migrate:up
npm run dev      # разработка, http://localhost:3000
npm run build && NODE_ENV=production npm start
npm test         # формулы НМЦК и сумма прописью
```

Переменные — `.env.example`. Скрипты миграций читают `.env`. В проде обязательно задайте `JWT_SECRET` (процесс без него не стартует).

После установки или обновления зависимостей смотрите `npm run audit` (`npm audit --omit=dev`). High/critical стоит разобрать; внутренний релиз из‑за аудита не блокируем (в Docker — `|| true`). Зеркало gitverse может не отдавать audit API — тогда команда завершится ошибкой, сборку из‑за этого не останавливаем.

## Границы интеграций

Текущий контур намеренно простой: сервер не парсит Office/PDF/ZIP, не выполняет исходящие HTTP-запросы и принимает только файлы контракта (`.pdf`/`.docx`) с проверкой расширения и magic bytes. Это снижает риск отказа и вредоносного контента.

Если появится новая интеграция (внешний API, импорт файлов, HTML из внешних систем, SMTP/LDAP и т.д.), заводите **отдельную задачу на ревью безопасности**. Короткий чеклист перед внедрением:

- источники и типы входных данных, лимиты и таймауты;
- SSRF/allowlist для исходящих URL и запрет доступа к внутренним IP;
- хранение вложений вне БД, проверка типа по содержимому;
- отсутствие `innerHTML`/`dangerouslySetInnerHTML` для внешнего HTML;
- оценка новых npm-пакетов (назначение, лицензия, свежесть, postinstall-скрипты).

Подробный чеклист и правила: [`.cursor/rules/security.mdc`](.cursor/rules/security.mdc).

## Учётные данные по умолчанию

При первом запуске создаётся администратор:

- **Логин:** `admin`
- **Пароль:** `admin`

Сразу смените пароль в личном кабинете (профиле) и заведите учётки сотрудников в панели управления.

## Структура

```
server.ts                 API Express + раздача SPA
src/server/db.ts          AppDatabase: CRUD пользователей, закупок, документов и контрагентов
src/server/db/postgres.ts PostgreSQL pool
src/server/db/mongo.ts    MongoDB client
src/server/storage/files.ts Контрактные файлы на volume
src/App.tsx               Маршруты /login /purchases /reports /cabinet /admin
src/components/           Экраны (Purchases, PurchaseDetail, MainApp, KpRequest, ServiceMemo, Login, Admin, Profile)
src/utils/math.ts         Формулы НМЦК
src/utils/numberToWords.ts Сумма прописью
src/utils/*.test.ts       Vitest (формулы)
src/utils/docxGenerator.ts     Word: обоснование НМЦК
src/utils/kpDocxGenerator.ts   Word: запрос КП
docs/                     Архитектура, API, предметная область
```
