# HTTP API

Базовый URL: тот же origin, что и SPA (`/api/...`). JSON, UTF-8.

Заголовок для защищённых маршрутов:

```
Authorization: Bearer <jwt>
```

Ошибки: `{ "error": "..." }` (тексты на русском). Успешные мутации: `{ "success": true, ... }`.

| Код | Когда |
|-----|--------|
| 400 | Нет полей логина, некорректный JSON, короткий пароль, дубликат username, неверный `type`, слишком большой `state`, лимит документов, пустое название контрагента, некорректный `id` контрагента |
| 401 | Нет токена или токен невалиден / истёк |
| 403 | Валидный пользователь без нужной роли |
| 404 | Контрагент не найден |
| 413 | Тело запроса больше лимита JSON (снимок `state` 256 КБ + запас) |
| 429 | Слишком много попыток входа с одного IP |
| 500 | Исключение / сбой записи файла БД |

## Служебные

### `GET /api/health` (публичный)

Ответ 200: `{ "status": "ok" }`. Без секретов и без обращения к БД сверх уже поднятого процесса. Нужен Docker HEALTHCHECK.

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

Тело: `{ "username", "password", "role?" }`. `role` по умолчанию `user` (только `admin` \| `user`). Пароль ≥ 5 символов. Дубликат username — 400.

## Настройки профиля (JWT, свой user)

### `GET /api/user/settings`

`{ customer, executorPosition, executorName, submissionEmail, contactPerson, contactPhone, defaultServicePlace, defaultServiceConditions }` или пустые строки.

### `POST /api/user/settings`

В `user.settings` попадают только поля `customer`, `executorPosition`, `executorName`, `submissionEmail`, `contactPerson`, `contactPhone`, `defaultServicePlace`, `defaultServiceConditions` (строки). Остальное из body игнорируется. Эти поля подставляются в НМЦК, запрос КП и будущие документы через схемы автозаполнения.

## История документов (JWT, свой user)

### `GET /api/user/documents`

Документы текущего пользователя, новые сверху. Побочный эффект: удаление всех записей старше 3 суток. Файл БД переписывается, только если что-то истекло.

Элемент: `{ id, userId, name, state, type, createdAt }` где `type` — `'nmck'` | `'kp'` | `'memo'`, `state` — полный снимок формы.

### `POST /api/user/documents`

Тело: `{ "name": string, "state": object, "type": "nmck" | "kp" | "memo" }`. `type` по умолчанию `nmck`.

Ограничения: `name` обязателен (до 500 символов); `type` только `nmck` \| `kp` \| `memo`; `state` — объект не больше 256 КБ JSON; не больше 50 документов на пользователя (после очистки старше 3 суток).

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

Скачивание `.docx` идёт с клиента (`generateDocx` / `generateKpDocx`). Статика SPA в production — любой `GET`, не начинающийся с обработанного `/api`.

Новые интеграционные маршруты (внешние HTTP, импорт вложений, обработка HTML извне) не добавляются «по пути»: для них нужна отдельная задача и проверка по чеклисту из `.cursor/rules/security.mdc`.
