/**
 * Кейс 4: связанные списки загружаются без N+1 — число SQL-запросов не зависит
 * от количества заявок на странице и откликов в карточке.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { type TestContext, api, createOrder, createVerifiedDriver, registerUser, setupTestApp } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

async function countQueries(fn: () => Promise<unknown>): Promise<number> {
  ctx.queries.length = 0;
  await fn();
  return ctx.queries.length;
}

describe('Загрузка связей без N+1', () => {
  test('список заявок: одинаковое число запросов для 2 и 12 заявок', async () => {
    const client = await registerUser(ctx, 'Client');
    const driver = await createVerifiedDriver(ctx);
    const addOrders = async (n: number) => {
      for (let i = 0; i < n; i += 1) {
        const order = await createOrder(ctx, client.token, { description: `Груз ${i}` });
        await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: driver.token, body: { price: 40000 + i } });
      }
    };
    const list = () => api(ctx, 'GET', '/orders?limit=50', { token: client.token });

    await addOrders(2);
    const small = await countQueries(list);
    await addOrders(10);
    const large = await countQueries(list);
    assert.equal((await list()).data.items.length, 12);
    assert.equal(small, large, `запросов: ${small} против ${large}`);
    assert.ok(large <= 5, `ожидалось не больше 5 запросов, выполнено ${large}`);
  });

  test('карточка заявки: одинаковое число запросов для 1 и 5 откликов', async () => {
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);
    const details = () => api(ctx, 'GET', `/orders/${order.id}`, { token: client.token });

    const first = await createVerifiedDriver(ctx);
    await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: first.token, body: { price: 40000 } });
    const one = await countQueries(details);

    for (let i = 0; i < 4; i += 1) {
      const d = await createVerifiedDriver(ctx);
      await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: d.token, body: { price: 41000 + i } });
    }
    const five = await countQueries(details);
    assert.equal((await details()).data.bids.length, 5);
    assert.equal(one, five, `запросов: ${one} против ${five}`);
  });
});
