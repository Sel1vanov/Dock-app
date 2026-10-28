# Работа с БД через ORM (кейс 4)

Сервер написан на TypeScript, поэтому вместо SQLAlchemy используется **MikroORM 7** — ORM того же типа
(Data Mapper + Unit of Work + Identity Map). Ни один SQL-запрос не пишется в HTTP-обработчиках или в интерфейсе:
обработчики (`routers/`) вызывают сервисы, сервисы — репозитории, и только репозитории обращаются к ORM.

## Соответствие понятий SQLAlchemy → MikroORM

| SQLAlchemy | MikroORM в Dock | Где |
|---|---|---|
| `DeclarativeBase`, класс-модель | `@Entity()` над классом | `server/src/models/*.ts` |
| `Mapped[str] = mapped_column(String(100))` | `@Property({ type: 'string', length: 100 }) fullName!: string` | `models/User.ts` |
| `mapped_column(primary_key=True)` | `@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })` | все модели |
| `ForeignKey('users.id', ondelete='CASCADE')` + `relationship()` | `@ManyToOne(() => User, { deleteRule: 'cascade' })` | `models/Vehicle.ts` |
| `relationship(back_populates=…)` (1:N) | `@OneToMany(() => Bid, (b) => b.order) bids = new Collection<Bid>(this)` | `models/Order.ts` |
| `relationship(secondary=association_table)` (N:M) | `@ManyToMany(() => CargoType, …, { pivotEntity: () => VehicleCargoType })` | `models/Vehicle.ts` |
| `CheckConstraint`, `UniqueConstraint`, `Index` | `@Check`, `@Unique`, `@Index` (в т. ч. частичные и GIN) | `models/Order.ts`, `models/Bid.ts` |
| `Session` | `EntityManager` (`em`) — свой на каждый HTTP-запрос: `orm.em.fork()` | `server/src/dependencies.ts` |
| `Depends(get_db)` | `getSession(request)` / `services(request)` | `dependencies.ts` |
| `session.execute(select(Order).where(…))` | `em.find(Order, { … })`, `em.findAndCount(…)`, `em.createQueryBuilder(…).select(…)` | `repositories/*.ts` |
| `.where().order_by().limit().offset()` | `{ where }, { orderBy, limit, offset }` | `repositories/OrderRepository.ts` |
| `session.add(obj)` | `em.create(Order, data)` (сразу помечается к сохранению) | репозитории |
| `session.delete(obj)` | `em.remove(entity)` | `VehicleRepository.remove` |
| `session.flush()` | `em.flush()` | сервисы |
| `session.commit()` / `rollback()` | `em.begin()` → `em.commit()` / `em.rollback()` | `services/BidService.ts → accept` |
| `selectinload(Order.bids)` | `populate: ['bids'], strategy: 'select-in'` | `OrderRepository.findDetails` |
| `joinedload(Order.client)` | `populate: ['client'], strategy: 'joined'` | `OrderRepository.listByClient` |
| `with_for_update()` | `lockMode: LockMode.PESSIMISTIC_WRITE` | `OrderRepository.findByIdForUpdate` |
| `IntegrityError` | `UniqueConstraintViolationException`, `ForeignKeyConstraintViolationException`, `CheckConstraintViolationException` | `services/AuthService.ts`, `core/errorHandler.ts` |
| Pydantic-схемы | zod-схемы в `server/src/schemas` (отдельно от моделей) | `schemas/*.ts` |
| Alembic | `@mikro-orm/migrations` | `database/migrations` |

## ORM-модели и схемы API разделены

ORM-модели (`server/src/models`) описывают таблицы. Схемы API (`server/src/schemas`) описывают JSON запросов
и ответов: `OrderCreateRequest`, `OrderUpdateRequest`, `OrderDetailsResponse`… Модель никогда не отдаётся клиенту
напрямую — ответ собирают функции `services/mappers.ts`, поэтому `password_hash` и чужие телефоны в API не
попадают. Поле `passwordHash` ещё и помечено в модели `hidden: true, lazy: true`: по умолчанию оно не выбирается
из БД вовсе, его явно запрашивает только вход (`UserRepository.findByEmailWithPassword`).

## Session: одна на запрос

```ts
// server/src/dependencies.ts
app.addHook('onRequest', async (request) => {
  request.em = deps.orm.em.fork();   // новая Session (свой Identity Map) на каждый HTTP-запрос
});
```

Глобальный `EntityManager` использовать запрещено (`allowGlobalContext: false` в `database/orm.ts`): случайно
разделить Session между запросами нельзя. Сервисы получают Session через `services(request)` — аналог `Depends`.

## CRUD основной сущности и операции со связанными

| Операция | API | Код |
|---|---|---|
| Create | `POST /orders` | `OrderService.create` → `OrderRepository.create` → `em.flush()` |
| Read (список) | `GET /orders?q=&cargoType=&status=&sort=&limit=&offset=` | `OrderRepository.listByClient / listByDriver` (`findAndCount`) |
| Read (карточка) | `GET /orders/{id}` | `OrderRepository.findDetails` (populate связей) |
| Update | `PATCH /orders/{id}` | `em.assign(order, fields)` → `em.flush()` |
| Delete | `DELETE /orders/{id}` | `em.remove(order)` → `em.flush()` (отклики/фото удаляются каскадно) |
| Связанные: отклик | `POST /orders/{id}/bids` | INSERT в `bids` + UPDATE статуса заявки — один `flush` |
| Связанные: ТС ↔ типы грузов | `POST/PATCH /vehicles` | `vehicle.cargoTypes.set([...])` — ORM сам меняет строки `vehicle_cargo_types` |

## Запросы с условиями, сортировкой, LIMIT и OFFSET

```ts
// server/src/repositories/OrderRepository.ts — лента водителя под ТС
this.em.findAndCount(Order, {
  status: { $in: ['Created', 'Bidding'] },
  cargoWeightKg: { $lte: vehicle.maxWeightKg },
  cargoLengthM: { $lte: vehicle.lengthM },
  cargoWidthM: { $lte: vehicle.widthM },
  cargoHeightM: { $lte: vehicle.heightM },
  cargoType: { $in: vehicle.cargoTypes.getIdentifiers('code') },   // связь N:M
  [searchExpression]: { $ilike: likePattern(q) },                   // поиск — параметром, не склейкой
}, { populate: ['client', 'cargoType'], strategy: 'joined', orderBy: [{ price: 'desc' }, { id: 'asc' }], limit, offset });
```

**SQL не склеивается с вводом пользователя.** Значения уходят в PostgreSQL параметрами (`$1, $2…`). Для `ILIKE`
спецсимволы `%` и `_` экранируются (`repositories/query.ts`), а строка вида `'; drop table orders; --` просто ищется
как текст — это проверяет тест `03-orders-crud.test.ts`.

## Транзакции: flush, commit, rollback

- **`em.flush()`** — Unit of Work вычисляет изменения всех загруженных сущностей и отправляет INSERT/UPDATE/DELETE
  **в одной транзакции**. Пример: отклик водителя (`BidService.place`) — INSERT в `bids` и UPDATE `orders.status`
  либо выполнятся оба, либо ни один.
- **Явная транзакция** нужна, когда шаги перемежаются чтением и прямыми запросами. Выбор исполнителя
  (`BidService.accept`) — многошаговая операция:

```ts
await em.begin();                                    // BEGIN
try {
  const bid = await this.bids.findById(bidId);
  const order = await this.orders.findByIdForUpdate(bid.order.id);   // SELECT … FOR UPDATE
  // проверки: автор заявки, заявка открыта, отклик ожидает
  order.driver = bid.driver; order.price = bid.offeredPrice; order.status = 'Assigned';
  bid.status = 'Accepted';
  await em.flush();                                  // UPDATE orders; UPDATE bids — ещё внутри транзакции
  await this.bids.rejectPendingExcept(order.id, bid.id);   // UPDATE bids … остальные → Rejected
  await em.commit();                                 // COMMIT
} catch (e) {
  await em.rollback();                               // ROLLBACK — ни одного частичного изменения
  throw e;
}
```

`SELECT … FOR UPDATE` блокирует строку заявки: два одновременных «Выбрать» не назначат двух исполнителей
(а частичный уникальный индекс `uk_bids_one_accepted` подстрахует на уровне БД).

**Как это доказано тестами** (`05-bids-transactions.test.ts`):
1. успешный выбор — в журнале SQL `begin … for update … update "orders" … update "bids" … commit`;
2. сбой на последнем шаге (имитирован) — `rollback`, заказ и отклики в БД остались прежними, клиент получил 500
   без текста исключения.

**Ошибки целостности.** Если два запроса одновременно прошли проверку сервиса (например, регистрация с одним
email), сработает UNIQUE в БД: `UniqueConstraintViolationException` перехватывается и превращается в 409
(`AuthService.register`, `BidService.place`, `ReviewService.create`). Остальные нарушения ограничений
обрабатывает `core/errorHandler.ts` (409/422 без SQL в ответе).

## Стратегия загрузки связей и N+1

N+1 — когда список из N записей загружается одним запросом, а связи каждой записи — ещё N запросами.

| Экран | Как загружается | Запросов |
|---|---|---|
| «Мои заявки» (страница до 50 заявок) | заявки + заказчик + тип груза **одним JOIN** (`joined` ≈ `joinedload`); число откликов — **один** `GROUP BY order_id … where order_id in (…)` | 3 (+1 — пользователь из токена) |
| Карточка заявки | заявка + заказчик + водитель JOIN-ом; отклики, фото, отзывы — по одному запросу `where order_id in (…)` (`select-in` ≈ `selectinload`); водители откликов, их ТС и типы грузов, рейтинги — по одному запросу `in (…)` | 8 (+1) — для 1 и для 50 откликов одинаково |

Реальный SQL списка (видно при `DB_DEBUG=true` в `server/.env`):

```sql
select count(*) from "orders" as "o0" inner join "users" as "c1" on … inner join "cargo_types" as "c2" on … where "o0"."client_id" = ? and (…) ilike ?
select "o0".*, "c1"."full_name" as "c1__full_name", …, "c2"."name" as "c2__name" from "orders" as "o0" inner join "users" … inner join "cargo_types" … order by … limit ? offset ?
select "b"."order_id", count(*) as count from "bids" as "b" where "b"."order_id" in (?, ?, …) group by "b"."order_id"
```

Тест `07-n-plus-one.test.ts` считает SQL-запросы: для 2 и 12 заявок, для 1 и 5 откликов их число одинаковое.

**Почему так.** `joined` выгоден для связей «к одному» (заказчик, тип груза) — данные приходят в той же строке.
Для коллекций (отклики, фото) JOIN размножил бы строки заявки, поэтому они грузятся отдельным запросом `IN (…)`
сразу для всех родителей.
