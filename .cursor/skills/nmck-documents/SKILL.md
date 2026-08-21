---
name: nmck-documents
description: >-
  Change NMCK calculations, 44-FZ wording, DOCX templates, KP request letters,
  or document history. Use when editing math.ts, docxGenerator, kpDocxGenerator,
  KpDocumentPreview, MainApp price grid, or /api/user/documents.
---

# Документы и расчёты НМЦК

Следуй [docs/domain.md](../../../docs/domain.md). Юридические тексты не переписывай своими словами.

## Чеклист правки расчёта

1. Измени формулу в `src/utils/math.ts`.
2. Убедись, что `MainApp.tsx` и `docxGenerator.ts` вызывают те же функции.
3. Нулевые цены не участвуют в среднем/СКО/CV.
4. СКО — выборка N−1. CV в процентах, 2 знака. CV > 33% в превью подсвечивается.
5. Заключение DOCX использует **min сумму поставщика** и сумму прописью (`formatAmountInWords`); таблица — средние × кол-во. Не «выравнивай» без задачи.
6. После правки формул — `npm test`.

## Чеклист правки шаблона КП

1. Меняй `kpDocxGenerator.ts` и `KpDocumentPreview.tsx` вместе.
2. Шрифт Times New Roman; в `docx` size — half-points (24 = 12pt).
3. Несколько вендоров → ZIP через `jszip`, один вендор → один файл.
4. После скачивания — `POST /api/user/documents` с `type: 'kp'` и полным `state`.

## Чеклист истории

- TTL 3 дня реализован в `getDocuments`, не в cron.
- `type` только `'nmck'` | `'kp'`.
- Не отдавай чужие `userId`.
