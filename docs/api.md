# HTTP API

Базовый URL: тот же origin, что и SPA (`/api/...`). JSON, UTF-8.

Заголовок для защищённых маршрутов:

```
Authorization: Bearer <jwt>
```

Ошибки: `{ "error": "..." }`. Успешные мутации: `{ "success": true, ... }`.

| Код | Когда |
|-----|--------|
| 400 | Нет полей логина, короткий пароль, дубликат username |
| 401 | Нет токена |
| 403 | Невалидный токен или не admin |
| 500 | Исключение / сбой записи файла БД |

## Auth

### `POST /api/auth/login` (публичный)

Тело: `{ "username": string, "password": string }`

Ответ 200: `{ "token": string, "user": { "id", "username", "role" } }`

Неверный логин и неверный пароль неотличимы (`Invalid credentials`).

### `POST /api/auth/change-password` (JWT)

Тело: `{ "newPassword": string }` (длина ≥ 5). Меняет пароль **текущего** пользователя (`req.user.id`).

## Пользователи (admin)

### `GET /api/users`

Список `{ id, username, role }` без хешей.

### `POST /api/users`

Тело: `{ "username", "password", "role?" }`. `role` по умолчанию `user`.

## Настройки профиля (JWT, свой user)

### `GET /api/user/settings`

`{ customer, executorPosition, executorName }` или пустые строки.

### `POST /api/user/settings`

Тело мержится в `user.settings`. Эти поля подставляются в калькулятор НМЦК при загрузке.

## История документов (JWT, свой user)

### `GET /api/user/documents`

Документы текущего пользователя, новые сверху. Побочный эффект: удаление всех записей старше 3 суток.

Элемент: `{ id, userId, name, state, type, createdAt }` где `type` — `'nmck'` | `'kp'`, `state` — полный снимок формы.

### `POST /api/user/documents`

Тело: `{ "name": string, "state": object, "type": "nmck" | "kp" }`. `type` по умолчанию `nmck`.

## Что не является API

Скачивание `.docx` идёт с клиента (`generateDocx` / `generateKpDocx`). Статика SPA в production — любой `GET`, не начинающийся с обработанного `/api`.
