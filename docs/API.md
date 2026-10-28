# Dock API v1 (кейс 2)

- **Версионирование:** все маршруты под префиксом `/api/v1` (`server/src/routers/index.ts`). Несовместимые
  изменения пойдут в `/api/v2`, а приложение, собранное под v1, продолжит работать.
- **Документация Swagger (OpenAPI 3.1):** <http://localhost:8000/docs>, JSON-спецификация —
  `/docs/json`. Генерируется из тех же схем, по которым проверяются запросы, поэтому не расходится с кодом.
  Кнопка «Authorize» → вставить `accessToken` из ответа `POST /api/v1/auth/login`.
- **Авторизация:** заголовок `Authorization: Bearer <JWT>`. Публичные эндпоинты отмечены ниже.

## Схемы запросов и ответов

Схемы — в `server/src/schemas` (zod — аналог Pydantic), отдельно для создания, изменения и ответа:

| Сущность | Создание | Изменение | Ответ |
|---|---|---|---|
| Пользователь | `RegisterRequest` | `UserUpdateRequest` | `UserResponse`, `TokenResponse` |
| ТС | `VehicleCreateRequest` | `VehicleUpdateRequest` (все поля необязательны, хотя бы одно) | `VehicleResponse` |
| Заявка | `OrderCreateRequest` | `OrderUpdateRequest` | `OrderListItemResponse`, `OrderDetailsResponse`, `OrderPageResponse` |
| Отклик | `BidCreateRequest` | `BidUpdateRequest` | `BidResponse`, `DriverBidResponse` |
| Отзыв | `ReviewCreateRequest` | — | `ReviewResponse` |
| Админ | — | `AdminUserUpdateRequest` | `AdminUserDetailsResponse`, `AdminUserPageResponse` |

Проверяются **типы** (`price: "дорого"` → 422), **обязательные поля**, **допустимые значения** (enum статусов
и ролей, диапазоны габаритов, длина строк, формат email/телефона/UUID) и **лишние поля** (`.strict()`:
`PATCH /users/me {"role":"Admin"}` → 422). Ответы тоже проходят через схему: поле, которого нет в схеме ответа,
клиенту не уйдёт.

## Коды ответов

| Код | Когда |
|---|---|
| **200** OK | чтение, изменение, действия над заявкой |
| **201** Created | регистрация, создание заявки/ТС/отклика/отзыва, загрузка фото и нового документа |
| **204** No Content | удаление заявки, ТС, отзыв отклика |
| 400 Bad Request | тело запроса — не JSON |
| **401** Unauthorized | нет токена, токен поддельный или истёк (`code: TOKEN_EXPIRED`), неверный пароль |
| **403** Forbidden | роль не та (водитель создаёт заявку), запись чужая, аккаунт заблокирован, водитель не проверен |
| **404** Not Found | записи нет (или маршрута нет) |
| **409** Conflict | дубликат (email, отклик, отзыв), действие недопустимо в текущем статусе (изменить заявку с откликами, оплатить дважды, «В пути» без фото) |
| 413 Payload Too Large | файл больше 5 МБ |
| **422** Unprocessable Entity | данные не прошли проверку схемой (с ошибками по полям) |
| 429 Too Many Requests | больше 10 попыток входа/регистрации в минуту с одного адреса |
| 500 Internal Server Error | непредвиденная ошибка — без подробностей, детали только в журнале сервера |

## Формат ошибки

Всегда одинаковый, без стека, SQL и текста исключений (`server/src/core/errorHandler.ts`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректный email",
    "details": [
      { "field": "email", "message": "Некорректный email" },
      { "field": "password", "message": "Пароль: минимум 8 символов" }
    ]
  }
}
```

Клиент подсвечивает поле по `details[].field` (`src/core/api.ts` → `ApiError.fieldErrors`).

## Эндпоинты

Базовый адрес: `http://<сервер>:8000/api/v1`. 🔓 — публичный, остальные требуют Bearer-токен.

### Авторизация и профиль

| Метод | Путь | Роль | Ответ |
|---|---|---|---|
| POST | `/auth/register` 🔓 | — | 201 `TokenResponse`; 409 email занят; 422 |
| POST | `/auth/login` 🔓 | — | 200 `TokenResponse`; 401 неверные данные; 403 заблокирован |
| GET | `/users/me` | любая | 200 `UserResponse` (с рейтингом) |
| PATCH | `/users/me` | любая | 200 — имя, телефон |
| GET | `/users/me/documents` | Driver | 200 документы с временными ссылками |
| PUT | `/users/me/documents/{passport\|license\|sts}` | Driver | 201 новый / 200 заменён; 409 уже на проверке |
| POST | `/users/me/verification` | Driver | 200 статус `pending`; 409 не все документы |
| GET | `/cargo-types` | любая | справочник типов груза |

### Транспорт

| Метод | Путь | Роль | Ответ |
|---|---|---|---|
| GET | `/vehicles` | Driver | мои ТС с типами грузов |
| POST | `/vehicles` | Driver | 201 |
| GET | `/vehicles/{id}` | владелец | 200; 403 чужое; 404 |
| PATCH | `/vehicles/{id}` | владелец | 200 (в т. ч. типы грузов — связь N:M) |
| DELETE | `/vehicles/{id}` | владелец | 204 |

### Заявки

| Метод | Путь | Роль | Ответ |
|---|---|---|---|
| GET | `/orders?status=&q=&cargoType=&sort=&limit=&offset=` | Client / Driver | страница: мои заявки (заказчик) или мои рейсы (водитель) |
| GET | `/orders/feed?vehicleId=&q=&cargoType=&sort=&limit=&offset=` | Driver | открытые заявки под ТС + `hiddenCount` |
| POST | `/orders` | Client | 201 `OrderDetailsResponse` |
| GET | `/orders/{id}` | участник / водитель (открытая заявка) | 200; 403; 404 |
| PATCH | `/orders/{id}` | автор | 200; 409 есть отклики |
| DELETE | `/orders/{id}` | автор | 204; 409 есть отклики |
| POST | `/orders/{id}/cancel` | автор | 200; 409 уже оплачена |
| POST | `/orders/{id}/payment` | автор | 200 (заморозка средств, демо) |
| POST | `/orders/{id}/status` | назначенный водитель | 200; 409 недопустимый переход |
| POST | `/orders/{id}/photos` | назначенный водитель | 201; 409 не тот этап; 422 не JPEG/PNG |
| POST | `/orders/{id}/complete` | автор | 200; 409 нет фото выгрузки |
| POST | `/orders/{id}/bids` | проверенный водитель | 201; 403 не проверен; 409 повтор / ТС не подходит |
| POST | `/orders/{id}/reviews` | участник | 201; 409 повтор; 403 посторонний |

Параметры списков: `sort` — `-createdAt` (по умолчанию), `createdAt`, `-price`, `price`; `limit` 1–50
(по умолчанию 20); `offset` ≥ 0; `status` — `active`, `archive` или конкретный статус. Ответ:
`{ items, total, limit, offset }`.

### Отклики

| Метод | Путь | Роль | Ответ |
|---|---|---|---|
| GET | `/bids/my?status=` | Driver | мои отклики вместе с заявками |
| PATCH | `/bids/{id}` | автор отклика | 200; 409 уже обработан |
| DELETE | `/bids/{id}` | автор отклика | 204 |
| POST | `/bids/{id}/accept` | автор заявки | 200 — одна транзакция; 409 уже выбран |
| POST | `/bids/{id}/reject` | автор заявки | 200 |

### Администрирование (роль Admin, иначе 403)

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/admin/users?verificationStatus=&role=&q=&limit=&offset=` | страница пользователей |
| GET | `/admin/users/{id}` | пользователь с документами и ТС |
| PATCH | `/admin/users/{id}` | `{"verificationStatus":"verified"\|"rejected"}`, `{"isBlocked":true}` |

### Служебные

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/health` 🔓 | `{"status":"ok"}` |
| GET | `/files/{key}?expires=&signature=` 🔓 | файл по **подписанной** ссылке (выдаётся в ответах API только тем, кому файл доступен; подделанная или устаревшая ссылка → 403) |

Итого 36 эндпоинтов. Все, кроме служебного `/health` (для мониторинга), вызываются мобильным приложением —
см. `src/repositories/*.ts`.

## Пример

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"client@dock.ru","password":"Dock12345"}'
```

```bash
curl -s "http://localhost:8000/api/v1/orders?status=active&sort=-price&limit=5" \
  -H "Authorization: Bearer <accessToken>"
```
