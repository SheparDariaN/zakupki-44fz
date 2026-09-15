# HTTP API

Базовый URL: тот же origin, что и SPA (`/api/...`). JSON, UTF-8. Контракт загружается через `multipart/form-data`; скачивание идёт через защищённый API.

Заголовок для защищённых маршрутов:

```
Authorization: Bearer <jwt>
```

Ошибки: `{ "error": "..." }` (тексты на русском). Успешные мутации: `{ "success": true, ... }`.

| Код | Когда |
|-----|--------|
| 400 | Нет обязательных полей, некорректный JSON, короткий пароль, дубликат username, неверный `kind`, слишком большой `state`, пустое название контрагента или закупки, некорректный id |
| 401 | Нет токена или токен невалиден / истёк |
| 403 | Валидный пользователь без нужной роли или попытка доступа к чужой закупке |
| 404 | Пользователь, контрагент, закупка, документ, ссылка, контракт или входящее КП не найдены |
| 413 | Тело запроса больше лимита JSON или файл контракта/КП больше лимита |
| 415 | Неподдерживаемый тип контракта |
| 429 | Слишком много попыток входа с одного IP |
| 500 | Исключение / сбой БД или файлового storage |

## Служебные

### `GET /api/health` (публичный)

Ответ 200 при живых подключениях: `{ "status": "ok", "postgres": "ok", "mongo": "ok" }`. Если один из backend недоступен, `status` не должен быть `ok`.

## Auth

### `POST /api/auth/login` (публичный)

Тело: `{ "username": string, "password": string }`

Ответ 200: `{ "token": string, "user": { "id", "username", "role", "mustChangePassword?" } }`

Неверный логин и неверный пароль неотличимы (`Неверный логин или пароль`). С одного IP не больше 10 неуспешных попыток за 15 минут (429). Bootstrap-админ с паролем `admin` получает `mustChangePassword: true`.

### `POST /api/auth/change-password` (JWT)

Тело: `{ "newPassword": string }` (длина ≥ 5). Меняет пароль **текущего** пользователя (`req.user.id`).

## Пользователи (admin)

### `GET /api/users`

Список `{ id, username, role }` без хешей.

### `POST /api/users`

Тело: `{ "username", "password", "role?" }`. `role` по умолчанию `user` (только `admin` | `user`). Пароль ≥ 5 символов. Дубликат username — 400.

## Настройки профиля (JWT, свой user)

### `GET /api/user/settings`

`{ customer, executorPosition, executorName, executorNameGenitive, executorNameDative, submissionEmail, contactPerson, contactPersonGenitive, contactPersonDative, contactPhone, contractServiceHeadPosition, contractServiceHeadName, contractServiceHeadNameGenitive, contractServiceHeadNameDative, defaultServiceConditions }` или пустые значения. `defaultServiceConditions` — массив строк (пункты типовых условий). Старое строковое значение с переносами строк нормализуется в список при импорте.

### `POST /api/user/settings`

В `users.settings` попадают только поля `customer`, `executorPosition`, `executorName`, `executorNameGenitive`, `executorNameDative`, `submissionEmail`, `contactPerson`, `contactPersonGenitive`, `contactPersonDative`, `contactPhone`, `contractServiceHeadPosition`, `contractServiceHeadName`, `contractServiceHeadNameGenitive`, `contractServiceHeadNameDative`, `defaultServiceConditions`. Остальное из body игнорируется, в том числе устаревшее `defaultServicePlace`.

## Закупки (JWT, только свои)

Все маршруты `/api/purchases/*` проверяют, что закупка принадлежит `req.user.id`. `kind` JSON-документа: `nmck` | `kp` | `memo`. Служебный `contract` используется отдельными маршрутами контракта. Входящие КП поставщиков — отдельные маршруты `/offers`, не путать с исходящим запросом КП (`kind = kp`).

### `GET /api/purchases`

Список закупок текущего пользователя, новые сверху. Элемент включает карточку и агрегаты: `{ id, name, price, budgetYear, createdAt, updatedAt, documentCounts, linksCount }`.

`documentCounts` содержит счётчики по видам документов, включая наличие контракта и число входящих КП.

### `POST /api/purchases`

Тело: `{ "name": string, "price"?: number | string | null, "budgetYear"?: number | null }`

Создаёт карточку закупки текущего пользователя. Ответ: `{ "success": true, "purchase": { ... } }`.

### `GET /api/purchases/:id`

Возвращает карточку закупки, метаданные документов и ссылки без тяжёлых JSON-состояний.

### `PUT /api/purchases/:id`

Тело: `{ "name": string, "price"?: number | string | null, "budgetYear"?: number | null }`

Обновляет карточку. `price` хранится как денежное значение с точностью 2 знака.

### `DELETE /api/purchases/:id`

Удаляет закупку каскадом: карточку, ссылки, метаданные PostgreSQL, JSON-состояния MongoDB, входящие КП и каталог файлов на volume.

## Документы закупки (JWT, только свои)

### `GET /api/purchases/:id/documents/:kind`

Возвращает сохранённое состояние документа: `{ kind, state, updatedAt }`. Если состояние ещё не создано — 404.

### `PUT /api/purchases/:id/documents/:kind`

Тело: `{ "state": object }`. Размер сериализованного `state` — не больше 256 КБ JSON.

Перезаписывает состояние в MongoDB по паре `(purchaseId, kind)` и обновляет метаданные в `purchase_documents`. Ответ: `{ "success": true, "document": { "kind", "updatedAt" } }`.

### `DELETE /api/purchases/:id/documents/:kind`

Удаляет JSON-состояние и метаданные документа данного вида. Не влияет на другие документы закупки.

### `GET /api/purchases/:id/context`

Возвращает данные для автозаполнения: карточку закупки, настройки пользователя, ссылки, метаданные и состояния всех JSON-документов закупки, контракт и список входящих КП (без байтов файлов). Используется при открытии НМЦК, КП, служебной записки и экрана входящих КП.

## Контракт закупки (JWT, только свои)

### `PUT /api/purchases/:id/contract`

`multipart/form-data` с одним файлом контракта. Допустимы `.pdf` и `.docx`, лимит около 10 МБ. Сервер проверяет расширение и magic bytes (`%PDF` или ZIP-контейнер DOCX), не парсит содержимое.

Повторная загрузка удаляет предыдущий файл и перезаписывает метаданные `kind = contract`.

### `GET /api/purchases/:id/contract`

Скачивает текущий контракт через API с `Content-Type` и именем файла из метаданных. Каталог файлов не раздаётся через `express.static`.

### `DELETE /api/purchases/:id/contract`

Удаляет файл контракта и метаданные `contract`.

## Входящие КП закупки (JWT, только свои)

Несколько файлов на закупку. Не путать с исходящим документом `kind = kp` (запрос КП).

### `GET /api/purchases/:id/offers`

Список метаданных: `{ id, purchaseId, registeredNumber, registeredDate, companyName, counterpartyId, mime, fileName, createdAt, updatedAt }`. Путь файла на volume клиенту не отдаётся.

### `POST /api/purchases/:id/offers`

`multipart/form-data`: обязательные `file`, `registeredNumber`, `registeredDate`; опционально `companyName`, `counterpartyId`. Файл: PDF, JPEG, PNG или WEBP, лимит около 10 МБ. Сервер проверяет расширение и magic bytes, не парсит содержимое. Если выбран контрагент без своего названия, подставляется `companyName` из справочника. Ответ: `{ "success": true, "offer": { ... } }`.

### `PUT /api/purchases/:id/offers/:offerId`

Те же поля, файл необязателен. Замена файла удаляет предыдущий.

### `GET /api/purchases/:id/offers/:offerId`

Отдаёт файл через API. По умолчанию `Content-Disposition: inline` для превью; `?download=1` — attachment.

### `DELETE /api/purchases/:id/offers/:offerId`

Удаляет запись и файл.

## Ссылки закупки (JWT, только свои)

### `GET /api/purchases/:id/links`

Возвращает список URL площадок закупки.

### `POST /api/purchases/:id/links`

Тело: `{ "url": string, "title"?: string }`. Создаёт ссылку закупки.

### `PUT /api/purchases/:id/links/:linkId`

Тело: `{ "url": string, "title"?: string }`. Обновляет ссылку, принадлежащую этой закупке.

### `DELETE /api/purchases/:id/links/:linkId`

Удаляет ссылку, принадлежащую этой закупке.

## Справочник контрагентов (JWT, общий)

Справочник доступен всем авторизованным пользователям. Записи общие для приложения, не привязаны к `userId`.

Элемент справочника:

```json
{
  "id": 1,
  "companyName": "ООО \"Поставщик\"",
  "shortName": "ООО \"Поставщик\"",
  "fullName": "Общество с ограниченной ответственностью \"Поставщик\"",
  "director": "Иванов Иван Иванович",
  "directorGenitive": "Иванова Ивана Ивановича",
  "directorDative": "Иванову Ивану Ивановичу",
  "email": "info@example.ru",
  "phone": "+7 (000) 000-00-00",
  "legalAddress": "г. Москва, ...",
  "postalAddress": "г. Москва, ...",
  "tags": ["поставка", "мебель"],
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000
}
```

`companyName` обязателен. Остальные строковые поля необязательны и сохраняются как пустые строки. Все строки обрезаются по краям, `tags` сохраняются как массив уникальных непустых строк.

### `GET /api/counterparties`

Возвращает общий список контрагентов, новые сверху.

### `POST /api/counterparties`

Тело: `{ "companyName": string, "shortName"?: string, "fullName"?: string, "director"?: string, "directorGenitive"?: string, "directorDative"?: string, "email"?: string, "phone"?: string, "legalAddress"?: string, "postalAddress"?: string, "tags"?: string[] }`

Ответ 200: `{ "success": true, "counterparty": { ... } }`

### `PUT /api/counterparties/:id`

Тело такое же, как у создания. Обновляет запись целиком с сохранением прежних значений для полей, которые не переданы.

Ответ 200: `{ "success": true, "counterparty": { ... } }`. Если `id` некорректный — 400, если записи нет — 404.

### `DELETE /api/counterparties/:id`

Удаляет запись из общего справочника.

Ответ 200: `{ "success": true }`. Если `id` некорректный — 400, если записи нет — 404.

## Что не является API

Генерация `.docx` и `.zip` идёт с клиента (`generateDocx` / `generateKpDocx` / batch-сценарии). Статика SPA в production — любой `GET`, не начинающийся с обработанного `/api`.

Новые интеграционные маршруты (внешние HTTP, импорт вложений, обработка HTML извне) не добавляются «по пути»: для них нужна отдельная задача и проверка по чеклисту из `.cursor/rules/security.mdc`.
