/**
 * Кейс 4: многошаговая операция «выбор исполнителя» атомарна — commit при успехе,
 * rollback при ошибке на любом шаге; уникальность отклика обеспечивается и сервисом, и БД.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { BidRepository } from '../src/repositories/BidRepository.js';
import { type TestContext, api, createOrder, createVerifiedDriver, registerUser, setupTestApp } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

async function state(orderId: string) {
  const em = ctx.orm.em.fork();
  const [order] = await em.execute<any[]>('select status, driver_id, price from orders where id = ?', [orderId]);
  const bids = await em.execute<any[]>('select driver_id, status from bids where order_id = ? order by created_at', [
    orderId,
  ]);
  return { order, bids };
}

describe('Отклики и выбор исполнителя', () => {
  test('неверифицированный водитель → 403; ТС не подходит → 409; повторный отклик → 409', async () => {
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);

    const newbie = await registerUser(ctx, 'Driver');
    const res = await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: newbie.token, body: { price: 40000 } });
    assert.equal(res.statusCode, 403);

    const smallTruck = await createVerifiedDriver(ctx, { maxWeightKg: 3000, cargoTypeCodes: ['Car'] });
    assert.equal(
      (await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: smallTruck.token, body: { price: 40000 } }))
        .statusCode,
      409,
    );

    const driver = await createVerifiedDriver(ctx);
    const first = await api(ctx, 'POST', `/orders/${order.id}/bids`, {
      token: driver.token,
      body: { price: 40000, comment: 'Завтра' },
    });
    assert.equal(first.statusCode, 201);
    assert.equal(first.data.status, 'Bidding', 'первый отклик переводит заявку в торг');
    assert.equal(first.data.myBid.price, 40000);
    assert.equal(first.data.bids.length, 0, 'чужие отклики водителю не показываются');

    const second = await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: driver.token, body: { price: 39000 } });
    assert.equal(second.statusCode, 409);
  });

  test('выбор исполнителя: заказ назначен, цена зафиксирована, остальные отклики отклонены (commit)', async () => {
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);
    const d1 = await createVerifiedDriver(ctx);
    const d2 = await createVerifiedDriver(ctx);
    await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: d1.token, body: { price: 41000 } });
    await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: d2.token, body: { price: 39000 } });

    const details = await api(ctx, 'GET', `/orders/${order.id}`, { token: client.token });
    assert.equal(details.data.bids.length, 2);
    assert.equal(details.data.bids[0].driver.phone, null, 'телефон водителя скрыт до выбора исполнителя');
    const chosen = details.data.bids.find((b: { driver: { id: string } }) => b.driver.id === d2.id);

    const strangerAttempt = await api(ctx, 'POST', `/bids/${chosen.id}/accept`, { token: d1.token });
    assert.equal(strangerAttempt.statusCode, 403);

    const accepted = await api(ctx, 'POST', `/bids/${chosen.id}/accept`, { token: client.token });
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.data.driver.phone !== null, true, 'после назначения контакты видны');

    const { order: row, bids } = await state(order.id);
    assert.deepEqual([row.status, row.driver_id, Number(row.price)], ['Assigned', d2.id, 39000]);
    assert.deepEqual(bids.map((b: { status: string }) => b.status).sort(), ['Accepted', 'Rejected']);

    const again = await api(ctx, 'POST', `/bids/${chosen.id}/accept`, { token: client.token });
    assert.equal(again.statusCode, 409);
  });

  test('ошибка на последнем шаге → rollback: в БД не остаётся частичных изменений', async () => {
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);
    const d1 = await createVerifiedDriver(ctx);
    const d2 = await createVerifiedDriver(ctx);
    const bid = (await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: d1.token, body: { price: 41000 } })).data
      .myBid;
    await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: d2.token, body: { price: 39000 } });

    // Имитируем сбой: шаги 1–2 (UPDATE orders, UPDATE bids) уже отправлены в БД, шаг 3 падает.
    const original = BidRepository.prototype.rejectPendingExcept;
    BidRepository.prototype.rejectPendingExcept = async () => {
      throw new Error('Сбой соединения с БД (имитация)');
    };
    try {
      const res = await api(ctx, 'POST', `/bids/${bid.id}/accept`, { token: client.token });
      assert.equal(res.statusCode, 500);
      assert.equal(
        res.data.error.message,
        'Внутренняя ошибка сервера. Попробуйте позже',
        'текст исключения не раскрывается',
      );
    } finally {
      BidRepository.prototype.rejectPendingExcept = original;
    }

    const { order: row, bids } = await state(order.id);
    assert.deepEqual([row.status, row.driver_id, Number(row.price)], ['Bidding', null, 45000], 'заказ не изменился');
    assert.deepEqual(
      bids.map((b: { status: string }) => b.status),
      ['Pending', 'Pending'],
      'отклики не изменились',
    );
  });

  test('водитель меняет и отзывает свой отклик; заявка без откликов снова «ищет исполнителя»', async () => {
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);
    const driver = await createVerifiedDriver(ctx);
    const other = await createVerifiedDriver(ctx);
    const bid = (await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: driver.token, body: { price: 41000 } }))
      .data.myBid;

    assert.equal(
      (await api(ctx, 'PATCH', `/bids/${bid.id}`, { token: other.token, body: { price: 1000 } })).statusCode,
      403,
    );
    const changed = await api(ctx, 'PATCH', `/bids/${bid.id}`, { token: driver.token, body: { price: 43000 } });
    assert.equal(changed.data.myBid.price, 43000);

    const my = await api(ctx, 'GET', '/bids/my', { token: driver.token });
    assert.equal(my.data.length, 1);
    assert.equal(my.data[0].order.id, order.id);

    assert.equal((await api(ctx, 'DELETE', `/bids/${bid.id}`, { token: driver.token })).statusCode, 204);
    const { order: row, bids } = await state(order.id);
    assert.equal(row.status, 'Created');
    assert.equal(bids.length, 0);
  });
});
