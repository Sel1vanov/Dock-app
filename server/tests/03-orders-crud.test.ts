/**
 * Кейс 5: обязательные тесты API — создание, получение, изменение, удаление, ошибочный сценарий —
 * с проверкой, что запись действительно сохранена в PostgreSQL и доступна при повторном запросе.
 * Кейс 1/4: серверный поиск, фильтрация, сортировка и пагинация (LIMIT/OFFSET).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  type TestContext,
  ORDER_BODY,
  api,
  createOrder,
  registerUser,
  setupTestApp,
  type TestUser,
} from './helpers.js';

let ctx: TestContext;
let client: TestUser;
before(async () => {
  ctx = await setupTestApp();
  client = await registerUser(ctx, 'Client');
});
after(() => ctx.close());

/** Читает строку напрямую из PostgreSQL, минуя API и Identity Map ORM. */
async function dbRow(id: string) {
  const rows = await ctx.orm.em.fork().execute<any[]>('select * from orders where id = ?', [id]);
  return rows[0];
}

describe('CRUD заявки', () => {
  let orderId: string;

  test('создание → 201, запись сохранена в PostgreSQL', async () => {
    const res = await api(ctx, 'POST', '/orders', { token: client.token, body: ORDER_BODY });
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.status, 'Created');
    assert.equal(res.data.cargo.typeName, 'Спецтехника');
    orderId = res.data.id;

    const row = await dbRow(orderId);
    assert.equal(row.client_id, client.id);
    assert.equal(Number(row.cargo_weight_kg), 8300);
    assert.equal(row.origin_address, ORDER_BODY.originAddress);
  });

  test('получение → 200, данные доступны при повторном запросе', async () => {
    const res = await api(ctx, 'GET', `/orders/${orderId}`, { token: client.token });
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.id, orderId);
    assert.equal(res.data.price, 45000);
    assert.equal(res.data.client.fullName, res.data.clientName);
  });

  test('изменение → 200, изменения видны в БД и в повторном запросе', async () => {
    const res = await api(ctx, 'PATCH', `/orders/${orderId}`, {
      token: client.token,
      body: { price: 52000, description: 'Экскаватор JCB 3CX + ковш' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(Number((await dbRow(orderId)).price), 52000);
    const again = await api(ctx, 'GET', `/orders/${orderId}`, { token: client.token });
    assert.equal(again.data.price, 52000);
    assert.equal(again.data.cargo.description, 'Экскаватор JCB 3CX + ковш');
  });

  test('удаление → 204, записи больше нет (404)', async () => {
    const res = await api(ctx, 'DELETE', `/orders/${orderId}`, { token: client.token });
    assert.equal(res.statusCode, 204);
    assert.equal(res.body, '');
    assert.equal(await dbRow(orderId), undefined);
    assert.equal((await api(ctx, 'GET', `/orders/${orderId}`, { token: client.token })).statusCode, 404);
  });

  test('ошибочные сценарии: 422 при неверных данных, 403 водителю и чужому заказчику, 404 несуществующей', async () => {
    const invalid = await api(ctx, 'POST', '/orders', {
      token: client.token,
      body: { ...ORDER_BODY, weightKg: -5, price: 'дорого', originAddress: '' },
    });
    assert.equal(invalid.statusCode, 422);
    const fields = invalid.data.error.details.map((d: { field: string }) => d.field);
    assert.ok(fields.includes('weightKg') && fields.includes('price') && fields.includes('originAddress'));

    const unknownType = await api(ctx, 'POST', '/orders', {
      token: client.token,
      body: { ...ORDER_BODY, cargoTypeCode: 'Rocket' },
    });
    assert.equal(unknownType.statusCode, 422);

    const driver = await registerUser(ctx, 'Driver');
    assert.equal((await api(ctx, 'POST', '/orders', { token: driver.token, body: ORDER_BODY })).statusCode, 403);

    const order = await createOrder(ctx, client.token);
    const stranger = await registerUser(ctx, 'Client');
    assert.equal((await api(ctx, 'GET', `/orders/${order.id}`, { token: stranger.token })).statusCode, 403);
    assert.equal(
      (await api(ctx, 'PATCH', `/orders/${order.id}`, { token: stranger.token, body: { price: 1 } })).statusCode,
      403,
    );
    assert.equal((await api(ctx, 'DELETE', `/orders/${order.id}`, { token: stranger.token })).statusCode, 403);

    assert.equal(
      (await api(ctx, 'GET', '/orders/00000000-0000-4000-8000-000000000000', { token: client.token })).statusCode,
      404,
    );
    assert.equal((await api(ctx, 'GET', '/orders/not-a-uuid', { token: client.token })).statusCode, 422);
  });
});

describe('Поиск, фильтрация, сортировка, пагинация', () => {
  let owner: TestUser;

  before(async () => {
    owner = await registerUser(ctx, 'Client');
    const items = [
      { description: 'Трактор Беларус 1221', cargoTypeCode: 'Agricultural', price: 30000 },
      { description: 'Экскаватор Hitachi', cargoTypeCode: 'Machinery', price: 70000 },
      {
        description: 'Генератор 200 кВт',
        cargoTypeCode: 'Equipment',
        price: 15000,
        originAddress: 'Тула, Красноармейский пр-т, 1',
      },
      { description: 'Каток Bomag', cargoTypeCode: 'Machinery', price: 50000 },
      { description: 'Погрузчик 50%_скидка', cargoTypeCode: 'Machinery', price: 20000 },
    ];
    for (const item of items) await createOrder(ctx, owner.token, item);
    const cancelled = await createOrder(ctx, owner.token, { description: 'Отменённая заявка' });
    await api(ctx, 'POST', `/orders/${cancelled.id}/cancel`, { token: owner.token, body: { reason: 'Передумал' } });
  });

  const list = (query: string) => api(ctx, 'GET', `/orders?${query}`, { token: owner.token });

  test('пагинация: limit/offset и общее количество', async () => {
    const page1 = await list('status=active&limit=2&offset=0');
    const page2 = await list('status=active&limit=2&offset=2');
    const page3 = await list('status=active&limit=2&offset=4');
    assert.equal(page1.data.total, 5);
    assert.deepEqual([page1.data.items.length, page2.data.items.length, page3.data.items.length], [2, 2, 1]);
    const ids = [...page1.data.items, ...page2.data.items, ...page3.data.items].map((o: { id: string }) => o.id);
    assert.equal(new Set(ids).size, 5, 'страницы не пересекаются');
  });

  test('сортировка по цене в обе стороны', async () => {
    const asc = (await list('status=active&sort=price')).data.items.map((o: { price: number }) => o.price);
    const desc = (await list('status=active&sort=-price')).data.items.map((o: { price: number }) => o.price);
    assert.deepEqual(asc, [15000, 20000, 30000, 50000, 70000]);
    assert.deepEqual(desc, [...asc].reverse());
  });

  test('поиск по описанию и адресу (ILIKE), спецсимволы ввода не ломают запрос', async () => {
    assert.equal((await list('q=экскаватор')).data.total, 1);
    assert.equal((await list('q=тула')).data.total, 1, 'поиск по адресу без учёта регистра');
    assert.equal((await list('q=50%25_')).data.total, 1, '% и _ ищутся как обычные символы');
    assert.equal((await list(`q=${encodeURIComponent("'; drop table orders; --")}`)).data.total, 0);
    assert.equal((await list('')).data.total, 6, 'таблица на месте');
  });

  test('фильтры: тип груза и статус', async () => {
    assert.equal((await list('cargoType=Machinery&status=active')).data.total, 3);
    assert.equal((await list('status=archive')).data.total, 1);
    assert.equal((await list('status=open')).data.total, 5, 'поиск исполнителя');
    assert.equal((await list('status=inProgress')).data.total, 0, 'исполнитель ещё не выбран');
    assert.equal((await list('status=Cancelled')).data.items[0].description, undefined);
    assert.equal((await list('status=Cancelled')).data.items[0].cargo.description, 'Отменённая заявка');
    assert.equal((await list('sort=name')).statusCode, 422, 'недопустимое значение сортировки');
    assert.equal((await list('limit=500')).statusCode, 422, 'limit ограничен');
  });
});
