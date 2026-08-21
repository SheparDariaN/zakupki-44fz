# Система обоснования НМЦК

Веб-приложение для расчёта начальной (максимальной) цены контракта (анализ рынка, 44-ФЗ) и генерации Word-документов: обоснование НМЦК и запрос коммерческого предложения. Есть вход по логину, роли, личный кабинет и панель администратора.

Документация для разработки: [docs/architecture.md](docs/architecture.md) · [docs/api.md](docs/api.md) · [docs/domain.md](docs/domain.md). Для агентов: [AGENTS.md](AGENTS.md).

## Стек

| Слой | Технологии |
|------|------------|
| Frontend | React 19, React Router 7, Vite 6, TypeScript, Tailwind CSS 4, lucide-react |
| Backend | Node.js 22, Express 4, JWT, bcryptjs |
| Данные | JSON-файл (`database.json` / `DB_FILE`) |
| Документы | `docx`, `file-saver`, `jszip` (генерация в браузере) |
| Деплой | Docker (multi-stage), docker compose, порт 3000 |

Пакеты ставятся через **npm** (`package-lock.json`).

## Запуск

### Docker (сервер)

Скопируйте `.env.example` в `.env` и задайте `JWT_SECRET` — Compose без него не поднимется.

```bash
cp .env.example .env   # затем замените JWT_SECRET
docker compose up -d --build
```

Приложение: `http://localhost:3000`. Проверка: `GET /api/health`. БД: `./data/database.json`.

### Без Docker

Нужен Node.js 18+ (в Docker — 22).

- Windows: `start.bat`
- Linux/macOS: `chmod +x start.sh && ./start.sh`

Или вручную:

```bash
npm install
npm run dev      # разработка, http://localhost:3000
npm run build && NODE_ENV=production npm start
npm test         # формулы НМЦК и сумма прописью
```

`start.sh` / `start.bat` ставят `NODE_ENV=production` сами. Переменные — `.env.example`. В проде обязательно задайте `JWT_SECRET` (процесс без него не стартует).

После установки или обновления зависимостей смотрите `npm run audit` (`npm audit --omit=dev`). High/critical стоит разобрать; внутренний релиз из‑за аудита не блокируем (в Docker — `|| true`). Зеркало gitverse может не отдавать audit API — тогда команда завершится ошибкой, сборку из‑за этого не останавливаем.

## Границы интеграций

Текущий контур намеренно простой: сервер не парсит Office/PDF/ZIP, не выполняет исходящие HTTP-запросы и не принимает пользовательские файлы. Это снижает риск отказа и вредоносного контента.

Если появится новая интеграция (внешний API, импорт файлов, HTML из внешних систем, SMTP/LDAP и т.д.), заводите **отдельную задачу на ревью безопасности**. Короткий чеклист перед внедрением:

- источники и типы входных данных, лимиты и таймауты;
- SSRF/allowlist для исходящих URL и запрет доступа к внутренним IP;
- хранение вложений вне `database.json`, проверка типа по содержимому;
- отсутствие `innerHTML`/`dangerouslySetInnerHTML` для внешнего HTML;
- оценка новых npm-пакетов (назначение, лицензия, свежесть, postinstall-скрипты).

Подробный чеклист и правила: [`.cursor/rules/security.mdc`](.cursor/rules/security.mdc).

## Учётные данные по умолчанию

При первом запуске создаётся администратор:

- **Логин:** `admin`
- **Пароль:** `admin`

Сразу смените пароль в панели управления и заведите учётки сотрудников.

## Структура

```
server.ts                 API Express + раздача SPA
src/server/db.ts          JSON-БД
src/App.tsx               Маршруты
src/components/           Экраны (MainApp, KpRequest, Login, Admin, Profile)
src/utils/math.ts         Формулы НМЦК
src/utils/numberToWords.ts Сумма прописью
src/utils/*.test.ts       Vitest (формулы)
src/utils/docxGenerator.ts     Word: обоснование НМЦК
src/utils/kpDocxGenerator.ts   Word: запрос КП
docs/                     Архитектура, API, предметная область
```
