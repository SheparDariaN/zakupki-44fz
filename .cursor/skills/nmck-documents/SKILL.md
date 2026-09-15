---
name: nmck-documents
description: >-
  Change NMCK calculations, 44-FZ wording, DOCX templates, KP request letters,
  service memos, purchase document states, or contract storage. Use when editing
  math.ts, docxGenerator, kpDocxGenerator, service memo generators/previews,
  KpDocumentPreview, MainApp price grid, /api/purchases/:id/documents, or
  /api/purchases/:id/contract.
---

# Документы и расчёты НМЦК

Следуй [docs/domain.md](../../../docs/domain.md). Юридические тексты не переписывай своими словами.

## Чеклист правки расчёта

1. Измени формулу в `src/utils/math.ts`.
2. Убедись, что `MainApp.tsx` и `docxGenerator.ts` вызывают те же функции.
3. Нулевые цены не участвуют в среднем/СКО/CV.
4. СКО — выборка N−1. CV в процентах, 2 знака. CV > 33% в превью подсвечивается.
5. Заключение DOCX использует **min сумму поставщика** и сумму прописью (`formatAmountInWords`); таблица — средние × кол-во. Не «выравнивай» без задачи.
6. Если при сохранении НМЦК карточка закупки без цены, используй ту же min сумму поставщика для автозаполнения цены.
7. После правки формул — `npm test`.

## Чеклист правки шаблона КП

1. Меняй `kpDocxGenerator.ts` и `KpDocumentPreview.tsx` вместе.
2. Шрифт Times New Roman; в `docx` size — half-points (24 = 12pt).
3. Несколько вендоров → ZIP через `jszip`, один вендор → один файл.
4. После сохранения/генерации — `PUT /api/purchases/:id/documents/kp` с полным `state`.

## Чеклист состояний документов

- `kind` только `'nmck'` | `'kp'` | `'memo'`.
- Состояния живут внутри закупки: `PUT/GET/DELETE /api/purchases/:id/documents/:kind`.
- Документ перезаписывается внутри закупки; профиль хранит только пользовательские настройки.
- Контекст автозаполнения загружай из `/api/purchases/:id/context`, включая карточку и соседние документы той же закупки.
- Не отдавай документы чужой закупки: всегда проверяй owner через `req.user.id`.

## Чеклист контракта

- Контракт — отдельный файл `.pdf` или `.docx`, не клиентский генератор.
- Загружай через `/api/purchases/:id/contract`, храни на volume, скачивай только через API.
- Проверяй расширение и magic bytes; не парси Office/PDF на сервере.
