/**
 * Полный сценарий (интеграционный путь Vision): заявка → отклик → выбор → оплата → погрузка с фото
 * → в пути → выгрузка с фото → приёмка → отзывы. Плюс отказ в недопустимых переходах (409)
 * и доступ к фото только по подписанной ссылке.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { type TestContext, TINY_JPEG, api, createOrder, createVerifiedDriver, registerUser, setupTestApp } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

describe('Исполнение рейса', () => {
  test('от публикации заявки до взаимных отзывов', async () => {
    const client = await registerUser(ctx, 'Client');
    const driver = await createVerifiedDriver(ctx);
    const outsider = await createVerifiedDriver(ctx);
    const order = await createOrder(ctx, client.token);
    const status = (path: string, body: object = {}) =>
      api(ctx, 'POST', `/orders/${order.id}${path}`, { token: driver.token, body });

    // Лента водителя показывает заявку под его ТС
    const feed = await api(ctx, 'GET', `/orders/feed?vehicleId=${driver.vehicleId}`, { token: driver.token });
    assert.ok(feed.data.items.some((o: { id: string }) => o.id === order.id));

    const bid = (await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: driver.token, body: { price: 44000 } })).data.myBid;
    await api(ctx, 'POST', `/bids/${bid.id}/accept`, { token: client.token });

    // До оплаты рейс начать нельзя
    let res = await status('/status', { status: 'Loading' });
    assert.equal(res.statusCode, 409);
    assert.match(res.data.error.message, /после оплаты/);

    res = await api(ctx, 'POST', `/orders/${order.id}/payment`, { token: driver.token });
    assert.equal(res.statusCode, 403, 'оплачивает только заказчик');
    res = await api(ctx, 'POST', `/orders/${order.id}/payment`, { token: client.token });
    assert.equal(res.data.isEscrowLocked, true);

    assert.equal((await status('/status', { status: 'Loading' })).data.status, 'Loading');
    assert.equal((await status('/status', { status: 'InTransit' })).statusCode, 409, 'без фото погрузки — нельзя');
    assert.equal((await api(ctx, 'POST', `/orders/${order.id}/photos`, {
      token: outsider.token,
      body: { stage: 'Loading', imageBase64: TINY_JPEG },
    })).statusCode, 403, 'фото загружает только назначенный водитель');

    res = await status('/photos', { stage: 'Loading', imageBase64: TINY_JPEG });
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.photos.length, 1);
    const photoUrl: string = res.data.photos[0].url;

    assert.equal((await status('/photos', { stage: 'Unloading', imageBase64: TINY_JPEG })).statusCode, 409);
    assert.equal((await status('/photos', { stage: 'Loading', imageBase64: 'bm90IGFuIGltYWdlIGF0IGFsbCwganVzdCBzb21lIHRleHQgdGhhdCBpcyBsb25nIGVub3VnaCB0byBwYXNzIHRoZSBtaW5pbXVtIGxlbmd0aCBjaGVjaw==' })).statusCode, 422, 'не изображение');

    assert.equal((await status('/status', { status: 'InTransit' })).data.status, 'InTransit');
    assert.equal((await status('/status', { status: 'Unloading' })).data.status, 'Unloading');

    res = await api(ctx, 'POST', `/orders/${order.id}/complete`, { token: client.token });
    assert.equal(res.statusCode, 409, 'приёмка без фото выгрузки невозможна');
    await status('/photos', { stage: 'Unloading', imageBase64: TINY_JPEG });
    res = await api(ctx, 'POST', `/orders/${order.id}/complete`, { token: client.token });
    assert.equal(res.data.status, 'Completed');
    assert.equal(res.data.isEscrowLocked, false, 'средства переведены исполнителю');

    // Отзывы обеих сторон, повтор — 409, посторонний — 403
    const review = { rating: 5, comment: 'Отлично' };
    assert.equal((await api(ctx, 'POST', `/orders/${order.id}/reviews`, { token: client.token, body: review })).statusCode, 201);
    assert.equal((await api(ctx, 'POST', `/orders/${order.id}/reviews`, { token: driver.token, body: { rating: 4 } })).statusCode, 201);
    assert.equal((await api(ctx, 'POST', `/orders/${order.id}/reviews`, { token: client.token, body: review })).statusCode, 409);
    assert.equal((await api(ctx, 'POST', `/orders/${order.id}/reviews`, { token: outsider.token, body: review })).statusCode, 403);
    assert.equal((await api(ctx, 'POST', `/orders/${order.id}/reviews`, { token: driver.token, body: { rating: 9 } })).statusCode, 422);

    const profile = await api(ctx, 'GET', '/users/me', { token: driver.token });
    assert.deepEqual(profile.data.rating, { average: 5, count: 1 });

    // Фото открывается по подписанной ссылке, подделанная или без подписи — 403
    const file = await ctx.app.inject({ method: 'GET', url: photoUrl });
    assert.equal(file.statusCode, 200);
    assert.equal(file.headers['content-type'], 'image/jpeg');
    const forged = photoUrl.replace(/signature=[^&]+/, 'signature=AAAA');
    assert.equal((await ctx.app.inject({ method: 'GET', url: forged })).statusCode, 403);
    assert.equal((await ctx.app.inject({ method: 'GET', url: photoUrl.split('?')[0] })).statusCode, 422);
    const otherClient = await registerUser(ctx, 'Client');
    assert.equal((await api(ctx, 'GET', `/orders/${order.id}`, { token: otherClient.token })).statusCode, 403);
  });

  test('отмена: до оплаты можно (отклики отклоняются), после оплаты — 409', async () => {
    const client = await registerUser(ctx, 'Client');
    const driver = await createVerifiedDriver(ctx);
    const order = await createOrder(ctx, client.token);
    await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: driver.token, body: { price: 44000 } });

    assert.equal((await api(ctx, 'PATCH', `/orders/${order.id}`, { token: client.token, body: { price: 1000 } })).statusCode, 409);
    assert.equal((await api(ctx, 'DELETE', `/orders/${order.id}`, { token: client.token })).statusCode, 409);

    const cancelled = await api(ctx, 'POST', `/orders/${order.id}/cancel`, { token: client.token, body: { reason: 'Нашли другого' } });
    assert.equal(cancelled.data.status, 'Cancelled');
    assert.equal(cancelled.data.bids[0].status, 'Rejected');

    const paid = await createOrder(ctx, client.token);
    const bid = (await api(ctx, 'POST', `/orders/${paid.id}/bids`, { token: driver.token, body: { price: 44000 } })).data.myBid;
    await api(ctx, 'POST', `/bids/${bid.id}/accept`, { token: client.token });
    await api(ctx, 'POST', `/orders/${paid.id}/payment`, { token: client.token });
    assert.equal((await api(ctx, 'POST', `/orders/${paid.id}/cancel`, { token: client.token, body: {} })).statusCode, 409);
  });
});
