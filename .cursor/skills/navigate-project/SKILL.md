---
name: navigate-project
description: >-
  Orient in the zakupki (НМЦК) repository: file map, stack, commands, and where
  to change API, UI, PostgreSQL, MongoDB, file storage, or DOCX. Use at the
  start of a task, when lost in the tree, or when adding screens, routes, data
  storage, or env vars.
---

# Навигация по zakupki

1. Прочитай [AGENTS.md](../../../AGENTS.md) — карта и инварианты.
2. Для устройства системы — [docs/architecture.md](../../../docs/architecture.md).
3. Для контракта HTTP — [docs/api.md](../../../docs/api.md).
4. Для формул и 44-ФЗ — [docs/domain.md](../../../docs/domain.md).

## Быстрый выбор файла

- Новый экран → `src/components/<Name>.tsx` + `<Route>` в `src/App.tsx`.
- Навигация разделов → `src/components/AppShell.tsx`; маршруты закупок начинаются с `/purchases`.
- Новый API → обработчик в `server.ts` + метод `AppDatabase` в `src/server/db.ts` или storage в `src/server/storage/files.ts`.
- PostgreSQL → CRUD в `src/server/db.ts`, pool в `src/server/db/postgres.ts`, миграции в `migrations/postgres/`.
- MongoDB state документов → CRUD в `src/server/db.ts`, client в `src/server/db/mongo.ts`, миграции в `migrations/mongo/`.
- Контрактный файл → `src/server/storage/files.ts`; не раздавай volume как static.
- Входящие КП → `src/components/PurchaseOffers.tsx` + `/api/purchases/:id/offers`; не путать с `kind = kp`.
- Типы формы/закупки → `src/types.ts`, затем UI и генератор.
- Формула денег/CV → только `src/utils/math.ts`, затем синхронизируй `MainApp` и `docxGenerator`.
- Шаблон Word НМЦК → `src/utils/docxGenerator.ts`.
- Шаблон Word КП → `src/utils/kpDocxGenerator.ts` **и** `KpDocumentPreview.tsx`.
- Стили-токены → `src/index.css`; утилиты — классы в JSX.

## Проверка

```bash
npm run lint
npm test
npm run migrate:up
```

Для ручной проверки API нужен `npm run dev` и JWT из `/api/auth/login`. PostgreSQL и MongoDB в Compose не публикуют порты на хост — локальный dev ходит в свои `DATABASE_URL` / `MONGODB_URI` (localhost или установленные рядом СУБД).

Не индексируй `node_modules/`, `dist/`, `data/`, дампы БД и контрактные файлы.
