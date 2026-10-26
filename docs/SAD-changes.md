# Предлагаемые правки в SAD и Vision

При реализации нашлись места, где документы расходятся между собой или с тем, как работает Supabase.
Ниже — что предлагается поправить и как это уже сделано в коде и БД.

## 1. Эндпоинты (SAD, раздел 9) — «Версия 3.0»

### Что не так в версии 2.0

1. **`POST /rest/v1/users` не нужен клиенту.** Пользователь регистрируется в Supabase Auth
   (`POST /auth/v1/signup`), а профиль в `public.users` создаёт триггер `on_auth_user_created`
   из метаданных регистрации. Так клиент не может сам выдать себе роль `Admin` или `is_verified = true`.
2. **Ответы `DELETE` вида `{"success": true, "message": "..."}` PostgREST не возвращает.** Он отвечает
   `204 No Content`, а с заголовком `Prefer: return=representation` — удалённой строкой.
3. **`PATCH` и `DELETE` без фильтра.** В PostgREST строка выбирается фильтром в URL:
   `PATCH /rest/v1/orders?id=eq.<uuid>`; `id` в теле запроса не указывает, какую строку менять.
4. **Выбор исполнителя через `PATCH /rest/v1/orders`.** Для него нужно изменить заказ и все отклики
   сразу. Отдельными запросами это не атомарно, поэтому сделан RPC-эндпоинт с транзакцией.
5. **`photo_url` с публичной ссылкой.** Фото груза и сканы паспортов не должны быть публичными.
   Бакеты приватные, в БД хранится путь к файлу, а для показа выдаётся временная подписанная ссылка.

### Новая таблица эндпоинтов

Базовый URL: `https://xvkimvpcrfsspyntalmg.supabase.co`. Во всех запросах передаются заголовки
`apikey: <publishable key>` и `Authorization: Bearer <JWT пользователя>`.

| Метод | Запрос | Тело / ответ |
|---|---|---|
| POST | `/auth/v1/signup` | `{"email","password","data":{"role":"Driver","full_name":"Иван Иванов","phone":"+79991112233"}}` → сессия; профиль создаётся триггером |
| POST | `/auth/v1/token?grant_type=password` | `{"email","password"}` → `{"access_token","refresh_token","user":{...}}` |
| GET | `/rest/v1/users?id=eq.<uuid>` | `[{"id","email","role","full_name","phone","is_verified","is_blocked","verification_doc_url","created_at","updated_at"}]` |
| PATCH | `/rest/v1/users?id=eq.<uuid>` | `{"full_name","phone","verification_doc_url":"documents/<uuid>/"}`. Поля `role`, `is_verified`, `is_blocked` меняет только администратор |
| POST | `/rest/v1/vehicles` | `{"driver_id","vehicle_type":"Trawl","model":"МАЗ-6430 + ЧМЗАП","max_weight":30000,"length":13.6,"width":3.2,"height":3.5}` |
| GET | `/rest/v1/vehicles?driver_id=eq.<uuid>` | `[{"id","driver_id","vehicle_type","model","max_weight","length","width","height","special_permits_url","created_at","updated_at"}]` |
| DELETE | `/rest/v1/vehicles?id=eq.<uuid>` | `204 No Content` |
| POST | `/rest/v1/orders` | `{"client_id","cargo_type":"Machinery","description":"Экскаватор JCB 3CX","cargo_weight":14500,"cargo_length":6.9,"cargo_width":2.9,"cargo_height":3.1,"origin_address","destination_address","price":85000}` → `status: "Created"` |
| GET | `/rest/v1/orders?client_id=eq.<uuid>&select=*,client:users!orders_client_id_fkey(full_name),bids(id)` | Заявки заказчика вместе с откликами, одним запросом |
| GET | `/rest/v1/orders?status=in.(Created,Bidding)&cargo_weight=lte.30000&cargo_length=lte.13.6&cargo_width=lte.3.2&cargo_height=lte.3.5&select=*,client:users!orders_client_id_fkey(full_name),my_bids:bids(id,status,offered_price)` | UC-09: лента под ТС, фильтр выполняется в БД |
| GET | `/rest/v1/orders?id=eq.<uuid>&select=*,client:users!orders_client_id_fkey(id,full_name,phone,is_verified),driver:users!orders_driver_id_fkey(...),bids(*,driver:users!bids_driver_id_fkey(id,full_name,phone,is_verified,vehicles(*))),order_photos(*),reviews(author_id)` | Карточка заказа со всеми связями одним запросом (без N+1) |
| PATCH | `/rest/v1/orders?id=eq.<uuid>` | `{"status":"Cancelled","cancel_reason":"..."}` / `{"is_escrow_locked":true}` / `{"status":"Loading"}` … — допустимые переходы в разделе 2 |
| POST | `/rest/v1/rpc/accept_bid` | `{"p_bid_id":"<uuid>"}` → заказ со `status: "Assigned"`, `driver_id` и `price` из отклика; остальные отклики `Rejected` |
| POST | `/rest/v1/bids` | `{"order_id","driver_id","offered_price":79000,"comment":"Могу завтра"}` → `status: "Pending"`; первый отклик переводит заказ в `Bidding` |
| GET | `/rest/v1/bids?driver_id=eq.<uuid>&select=*,order:orders(*)` | Отклики водителя вместе с заказами |
| PATCH | `/rest/v1/bids?id=eq.<uuid>` | Водитель: `{"offered_price","comment"}`; заказчик: `{"status":"Rejected"}` |
| DELETE | `/rest/v1/bids?id=eq.<uuid>` | Отозвать отклик (только `Pending`) → `204` |
| POST | `/storage/v1/object/order-photos/<order_id>/<stage>/<file>.jpg` | Загрузка фото (только назначенный водитель) |
| POST | `/storage/v1/object/sign/order-photos` | `{"paths":[...],"expiresIn":3600}` → подписанные ссылки одним запросом |
| POST | `/rest/v1/order_photos` | `{"order_id","photo_url":"<order_id>/Loading/1730000000.jpg","stage":"Loading"}` |
| POST | `/rest/v1/reviews` | `{"order_id","author_id","target_id","rating":5,"comment":"Отлично!"}`. Только после `Completed`, по одному отзыву от каждой стороны |
| GET | `/rest/v1/reviews?target_id=in.(<uuid>,<uuid>)&select=target_id,rating` | Рейтинги нескольких пользователей одним запросом |
| POST / GET / PATCH | `/rest/v1/disputes` | Без изменений относительно версии 2.0, плюс фильтр `?id=eq.` для PATCH (экраны — на следующем этапе) |

## 2. Статусная модель заказа (SAD, раздел 5, класс Order)

В SAD у `Order.status` три значения (`Created, InProgress, Completed`), а в БД и в Vision этапов больше.
Предлагается указать в SAD полный список и соответствие формулировкам из Vision:

| `order_status` | Как назван в Vision | Кто переводит | Условие |
|---|---|---|---|
| `Created` | Поиск исполнителя | — | заявка опубликована |
| `Bidding` | (идёт торг) | автоматически | поступил первый отклик |
| `Assigned` + `is_escrow_locked=false` | Ожидает оплаты | заказчик (`accept_bid`) | выбран исполнитель |
| `Assigned` + `is_escrow_locked=true` | Оплачен / ожидает погрузки | заказчик | оплата (безопасная сделка) |
| `Loading` | Прибыл на погрузку | водитель | заказ оплачен |
| `InTransit` | В пути | водитель | есть фото погрузки |
| `Unloading` | Прибыл на выгрузку | водитель | — |
| `Completed` | Завершён | заказчик (приёмка) | есть фото выгрузки; эскроу снимается |
| `Cancelled` | Отменена | заказчик | до оплаты |
| `Disputed` | (спор) | — | следующий этап |

Переходы проверяются триггером `orders_guard`: обойти их прямым REST-запросом нельзя.

## 3. Изменения схемы БД

| Таблица | Изменение | Зачем |
|---|---|---|
| `orders` | `cargo_type` (enum), `description` | UC-03: «Указать тип спецтехники и описание»; Vision 4.2 — выбор категорий груза по иконкам |
| `orders` | `cancel_reason` | UC-07: «Указать причину отмены» |
| `bids` | `comment` | UC-11: «Указать комментарий» к встречной цене |
| `vehicles` | `vehicle_type` (трал/манипулятор/эвакуатор…), `model` | Vision 4.2 — подбор по типу спецтехники; карточка ТС в откликах |
| `reviews` | `UNIQUE(order_id)` → `UNIQUE(order_id, author_id)` | UC-19: отзыв оставляют обе стороны, раньше это было невозможно |
| все | индексы по внешним ключам и `status`, триггеры `updated_at` | производительность ленты и списков |

## 4. Прочие несоответствия в документах

**SAD**

- Разделы 5.1–5.2: между ViewModel и репозиториями добавлен **сервисный слой** (лекции 5–6), а в
  пакет Repositories — `BidRepository`, `PhotoRepository`, `ReviewRepository`, `StorageRepository`,
  `AuthRepository`. Сейчас в SAD описано только 3 репозитория, а ViewModel обращаются к ним напрямую.
- Раздел 5.2: стоит добавить пакет **DTO** (`src/models/dto.ts`) и описать его роль.
- Раздел 7 (Deployment View) можно заполнить: мобильные устройства (iOS/Android, Expo) и браузер ↔
  HTTPS ↔ Supabase (PostgreSQL 17, Auth, Storage; регион eu-central-1).
- Раздел 8 (Implementation View): структура `src/` из README.
- Единицы измерения: в примерах SAD `cargo_weight: 2500.00` — это килограммы, а в Vision (UC-04) масса
  вводится в тоннах. Предлагается явно написать: в БД — кг и метры, в интерфейсе — тонны и метры
  (конвертация в маппере DTO).

**Vision**

- UC-12, шаг «Заморозить средства (UC-15)» → должно быть **UC-13**.
- UC-18, предусловие ссылается на UC-19 → должно быть **UC-15/UC-17** (статус «Прибыл на выгрузку» и фото).
- Раздел 6 «Целевые платформы: iOS» расходится с SAD (iOS/Android). React Native даёт обе платформы —
  предлагается указать iOS и Android.
- Раздел 6 «Доступ к просмотру полной ленты — только после проверки». Сейчас реализовано мягче:
  неверифицированный водитель видит ленту только для просмотра, а отклик блокируется (и в UI, и в БД).
  Так водитель сразу видит, зачем проходить верификацию. Если нужен строгий вариант — это одна строка в
  RLS-политике `orders_select`.
- Торг сейчас односторонний: водитель предлагает цену, заказчик принимает или отклоняет. «Согласованная
  корректировка цены» (встречное предложение заказчика) — кандидат на следующий этап.
