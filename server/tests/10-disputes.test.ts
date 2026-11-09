/**
 * Споры (UC-20 «Открыть спор», UC-21 «Разрешить спор»): кто и когда может открыть спор,
 * приостановка рейса, решение администратора в пользу каждой из сторон в одной транзакции.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { NotificationRepository } from '../src/repositories/NotificationRepository.js';
import {
  type TestContext,
  type TestUser,
  TINY_JPEG,
  api,
  createAdmin,
  createOrder,
  createVerifiedDriver,
  registerUser,
  setupTestApp,
} from './helpers.js';

let ctx: TestContext;
let admin: TestUser;
before(async () => {
  ctx = await setupTestApp();
  admin = await createAdmin(ctx);
});
after(() => ctx.close());

/** Заказ с выбранным исполнителем; paid — оплачен (средства заморожены), можно ехать. */
async function tripOrder(paid = true) {
  const client = await registerUser(ctx, 'Client');
  const driver = await createVerifiedDriver(ctx);
  const order = await createOrder(ctx, client.token);
  const bid = (await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: driver.token, body: { price: 45000 } })).data
    .myBid;
  await api(ctx, 'POST', `/bids/${bid.id}/accept`, { token: client.token });
  if (paid) await api(ctx, 'POST', `/orders/${order.id}/payment`, { token: client.token });
  return { client, driver, orderId: order.id as string };
}

const openDispute = (orderId: string, token: string, reason = 'Груз повреждён при погрузке') =>
  api(ctx, 'POST', `/orders/${orderId}/disputes`, { token, body: { reason } });

const resolve = (disputeId: string, status: string, token = admin.token) =>
  api(ctx, 'PATCH', `/admin/disputes/${disputeId}`, {
    token,
    body: { status, resolutionComment: 'Проверили фото и переписку сторон' },
  });

async function orderRow(orderId: string) {
  const [row] = await ctx.orm.em
    .fork()
    .execute<any[]>('select status, is_escrow_locked, cancel_reason from orders where id = ?', [orderId]);
  return row;
}

async function notificationTypes(token: string) {
  const res = await api(ctx, 'GET', '/notifications?limit=50', { token });
  return res.data.items.map((n: { type: string }) => n.type) as string[];
}

describe('Открытие спора (UC-20)', () => {
  test('водитель открывает спор в пути → 201, рейс приостановлен, стороны и администратор уведомлены', async () => {
    const { client, driver, orderId } = await tripOrder();
    await api(ctx, 'POST', `/orders/${orderId}/status`, { token: driver.token, body: { status: 'Loading' } });

    const res = await openDispute(orderId, driver.token, 'Заказчик не отдаёт груз, простой 5 часов');
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.status, 'Disputed');
    assert.equal(res.data.dispute.status, 'Open');
    assert.equal(res.data.dispute.orderStatusAtOpen, 'Loading', 'запомнен этап рейса');
    assert.equal(res.data.dispute.openedBy.role, 'Driver');
    assert.deepEqual(await orderRow(orderId), { status: 'Disputed', is_escrow_locked: true, cancel_reason: null });

    // Пока спор открыт, рейс не двигается, приёмки и второго спора нет
    const step = await api(ctx, 'POST', `/orders/${orderId}/status`, {
      token: driver.token,
      body: { status: 'InTransit' },
    });
    assert.equal(step.statusCode, 409);
    assert.match(step.data.error.message, /спор/);
    const photo = await api(ctx, 'POST', `/orders/${orderId}/photos`, {
      token: driver.token,
      body: { stage: 'Loading', imageBase64: TINY_JPEG },
    });
    assert.equal(photo.statusCode, 409);
    assert.equal((await api(ctx, 'POST', `/orders/${orderId}/complete`, { token: client.token })).statusCode, 409);
    assert.equal((await openDispute(orderId, client.token)).statusCode, 409, 'второй спор не открыть');

    assert.ok((await notificationTypes(client.token)).includes('DisputeOpened'), 'заказчику пришло уведомление');
    assert.ok((await notificationTypes(admin.token)).includes('DisputeOpened'), 'администратору пришло уведомление');

    // Заказ в разделе «В работе» у заказчика
    const inProgress = await api(ctx, 'GET', '/orders?status=inProgress', { token: client.token });
    assert.ok(inProgress.data.items.some((o: { id: string }) => o.id === orderId));
  });

  test('до оплаты → 409; посторонний → 403; без причины → 422; нет заказа → 404', async () => {
    const { client, orderId } = await tripOrder(false);
    const res = await openDispute(orderId, client.token);
    assert.equal(res.statusCode, 409, 'спор — после оплаты');
    assert.match(res.data.error.message, /после оплаты/);

    await api(ctx, 'POST', `/orders/${orderId}/payment`, { token: client.token });
    const stranger = await registerUser(ctx, 'Client');
    assert.equal((await openDispute(orderId, stranger.token)).statusCode, 403);
    assert.equal((await openDispute(orderId, admin.token)).statusCode, 403, 'администратор спор не открывает');

    const empty = await openDispute(orderId, client.token, '   ');
    assert.equal(empty.statusCode, 422);
    assert.equal(empty.data.error.details[0].field, 'reason');
    assert.equal((await openDispute('00000000-0000-4000-8000-000000000000', client.token)).statusCode, 404);
  });

  test('база данных сама не даёт открыть второй спор по заказу (частичный уникальный индекс)', async () => {
    const { client, driver, orderId } = await tripOrder();
    await openDispute(orderId, client.token);
    const em = ctx.orm.em.fork();
    await assert.rejects(
      em.execute(
        `insert into disputes (order_id, opened_by_id, reason, order_status_at_open) values (?, ?, 'Ещё один спор', 'Assigned')`,
        [orderId, driver.id],
      ),
      /uk_disputes_order_open/,
    );
  });
});

describe('Решение спора администратором (UC-21)', () => {
  test('в пользу водителя: заказ завершён, средства переведены, можно оставить отзывы', async () => {
    const { client, driver, orderId } = await tripOrder();
    const dispute = (await openDispute(orderId, client.token)).data.dispute;

    // Очередь администратора
    const queue = await api(ctx, 'GET', '/admin/disputes?status=Open', { token: admin.token });
    assert.equal(queue.statusCode, 200);
    const item = queue.data.items.find((d: { id: string }) => d.id === dispute.id);
    assert.equal(item.order.id, orderId);
    assert.equal(item.order.driverName.startsWith('Водитель'), true);

    const res = await resolve(dispute.id, 'ResolvedDriver');
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.status, 'ResolvedDriver');
    assert.ok(res.data.resolvedAt);
    assert.deepEqual(await orderRow(orderId), { status: 'Completed', is_escrow_locked: false, cancel_reason: null });

    assert.ok((await notificationTypes(driver.token)).includes('DisputeResolved'));
    assert.ok((await notificationTypes(client.token)).includes('DisputeResolved'));
    const review = await api(ctx, 'POST', `/orders/${orderId}/reviews`, { token: driver.token, body: { rating: 4 } });
    assert.equal(review.statusCode, 201, 'после завершения стороны оценивают друг друга');

    // Карточка заказа показывает решение участникам
    const details = await api(ctx, 'GET', `/orders/${orderId}`, { token: client.token });
    assert.equal(details.data.dispute.status, 'ResolvedDriver');
    assert.equal(details.data.dispute.resolutionComment, 'Проверили фото и переписку сторон');

    assert.equal((await resolve(dispute.id, 'ResolvedClient')).statusCode, 409, 'повторно решить нельзя');
  });

  test('в пользу заказчика: заказ отменён, средства возвращены, причина в заказе', async () => {
    const { client, orderId } = await tripOrder();
    const dispute = (await openDispute(orderId, client.token)).data.dispute;
    assert.equal((await resolve(dispute.id, 'ResolvedClient')).statusCode, 200);
    const row = await orderRow(orderId);
    assert.equal(row.status, 'Cancelled');
    assert.equal(row.is_escrow_locked, false);
    assert.match(row.cancel_reason, /^Спор решён в пользу заказчика/);
    const open = await api(ctx, 'GET', '/admin/disputes?status=Open', { token: admin.token });
    assert.ok(!open.data.items.some((d: { id: string }) => d.id === dispute.id), 'спор ушёл из очереди');
  });

  test('решать споры может только администратор; неверное решение → 422', async () => {
    const { client, driver, orderId } = await tripOrder();
    const dispute = (await openDispute(orderId, client.token)).data.dispute;
    assert.equal((await api(ctx, 'GET', '/admin/disputes', { token: client.token })).statusCode, 403);
    assert.equal((await resolve(dispute.id, 'ResolvedDriver', driver.token)).statusCode, 403);
    const bad = await api(ctx, 'PATCH', `/admin/disputes/${dispute.id}`, {
      token: admin.token,
      body: { status: 'Open', resolutionComment: 'ok' },
    });
    assert.equal(bad.statusCode, 422);
    assert.equal((await orderRow(orderId)).status, 'Disputed', 'заказ не изменился');
  });

  test('два администратора одновременно: решение одно, второй получает 409 (FOR UPDATE)', async () => {
    const { client, orderId } = await tripOrder();
    const dispute = (await openDispute(orderId, client.token)).data.dispute;
    const admin2 = await createAdmin(ctx);
    const results = await Promise.all([
      resolve(dispute.id, 'ResolvedClient'),
      resolve(dispute.id, 'ResolvedDriver', admin2.token),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const winner = results.find((r) => r.statusCode === 200)!.data.status;
    assert.equal((await orderRow(orderId)).status, winner === 'ResolvedClient' ? 'Cancelled' : 'Completed');
  });

  test('сбой на последнем шаге → rollback: спор, заказ и уведомления не изменились', async () => {
    const { client, orderId } = await tripOrder();
    const dispute = (await openDispute(orderId, client.token)).data.dispute;
    const original = NotificationRepository.prototype.markReadByOrder;
    NotificationRepository.prototype.markReadByOrder = async () => {
      throw new Error('Сбой соединения с БД (имитация)');
    };
    try {
      assert.equal((await resolve(dispute.id, 'ResolvedDriver')).statusCode, 500);
    } finally {
      NotificationRepository.prototype.markReadByOrder = original;
    }
    assert.deepEqual(await orderRow(orderId), { status: 'Disputed', is_escrow_locked: true, cancel_reason: null });
    const [row] = await ctx.orm.em.fork().execute<any[]>('select status from disputes where id = ?', [dispute.id]);
    assert.equal(row.status, 'Open');
    assert.ok(!(await notificationTypes(client.token)).includes('DisputeResolved'), 'уведомления откатились');
  });
});
