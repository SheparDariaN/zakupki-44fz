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

```bash
docker compose up -d --build
```

Приложение: `http://localhost:3000`. БД: `./data/database.json`.

### Без Docker

Нужен Node.js 18+ (в Docker — 22).

- Windows: `start.bat`
- Linux/macOS: `chmod +x start.sh && ./start.sh`

Или вручную:

```bash
npm install
npm run dev      # разработка, http://localhost:3000
npm run build && npm start   # production (задайте NODE_ENV=production)
```

Переменные — `.env.example`. В проде обязательно задайте `JWT_SECRET`.

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
src/utils/docxGenerator.ts     Word: обоснование НМЦК
src/utils/kpDocxGenerator.ts   Word: запрос КП
docs/                     Архитектура, API, предметная область
```
