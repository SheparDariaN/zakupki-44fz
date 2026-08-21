---
name: navigate-project
description: >-
  Orient in the zakupki (НМЦК) repository: file map, stack, commands, and
  where to change API, UI, JSON DB, or DOCX. Use at the start of a task, when
  lost in the tree, or when adding screens, routes, or env vars.
---

# Навигация по zakupki

1. Прочитай [AGENTS.md](../../../AGENTS.md) — карта и инварианты.
2. Для устройства системы — [docs/architecture.md](../../../docs/architecture.md).
3. Для контракта HTTP — [docs/api.md](../../../docs/api.md).
4. Для формул и 44-ФЗ — [docs/domain.md](../../../docs/domain.md).

## Быстрый выбор файла

- Новый экран → `src/components/<Name>.tsx` + `<Route>` в `src/App.tsx`.
- Новый API → обработчик в `server.ts` + метод в `src/server/db.ts` (не новый SQL).
- Типы формы → `src/types.ts`, затем UI и генератор.
- Формула денег/CV → только `src/utils/math.ts`, затем синхронизируй `MainApp` и `docxGenerator`.
- Шаблон Word НМЦК → `src/utils/docxGenerator.ts`.
- Шаблон Word КП → `src/utils/kpDocxGenerator.ts` **и** `KpDocumentPreview.tsx`.
- Стили-токены → `src/index.css`; утилиты — классы в JSX.

## Проверка

```bash
npm run lint
```

Для ручной проверки API нужен `npm run dev` и JWT из `/api/auth/login`.

Не индексируй `node_modules/`, `dist/`, `data/`, `database.json`.
