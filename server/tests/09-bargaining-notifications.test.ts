/** Встречная цена заказчика, уведомления, смена пароля и сброс пароля через администратора. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  type TestContext,
  TINY_JPEG,
  api,
  createAdmin,
  createOrder,
  createVerifiedDriver,
  registerUser,
  setupTestApp,
} from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

async function notifications(token: string) {
  const res = await api(ctx, 'GET', '/notifications?limit=50', { token });
  assert.equal(res.statusCode, 200);
  return res.data as {
    items: { id: string; type: string; orderId: string | null; relatedUserId: string | null; isRead: boolean }[];
    total: number;
    unreadCount: number;
  };
}

describe('Торг и уведомления', () => {
  test('встречная цена: заказчик предлагает, водитель соглашается, стороны получают уведомления', async () => {
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);
    const d1 = await createVerifiedDriver(ctx);
    const d2 = await createVerifiedDriver(ctx);
    const bid = (await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: d1.token, body: { price: 50000 } })).data
      .myBid;
    await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: d2.token, body: { price: 47000 } });

    let page = await notifications(client.token);
    assert.equal(page.unreadCount, 2, 'заказчику — по уведомлению на каждый отклик');
    assert.ok(page.items.every((n) => n.type === 'BidPlaced' && n.orderId === order.id));

    assert.equal(
      (await api(ctx, 'POST', `/bids/${bid.id}/counter`, { token: d2.token, body: { price: 45000 } })).statusCode,
      403,
      'встречную цену предлагает только автор заявки',
    );
    assert.equal(
      (await api(ctx, 'POST', `/bids/${bid.id}/counter`, { token: client.token, body: { price: 50000 } })).statusCode,
      409,
      'цена совпадает с ценой водителя',
    );
    let res = await api(ctx, 'POST', `/bids/${bid.id}/counter`, { token: client.token, body: { price: 45000 } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.bids.find((b: { id: string }) => b.id === bid.id).counterPrice, 45000);

    res = await api(ctx, 'GET', `/orders/${order.id}`, { token: d1.token });
    assert.deepEqual(
      [res.data.myBid.price, res.data.myBid.counterPrice],
      [50000, 45000],
      'водитель видит встречную цену',
    );
    assert.equal((await notifications(d1.token)).items[0].type, 'CounterOffer');

    assert.equal(
      (await api(ctx, 'POST', `/bids/${bid.id}/accept-counter`, { token: d2.token })).statusCode,
      403,
      'чужой отклик',
    );
    res = await api(ctx, 'POST', `/bids/${bid.id}/accept-counter`, { token: d1.token });
    assert.equal(res.statusCode, 200);
    assert.deepEqual([res.data.myBid.price, res.data.myBid.counterPrice], [45000, null]);
    assert.equal((await api(ctx, 'POST', `/bids/${bid.id}/accept-counter`, { token: d1.token })).statusCode, 409);
    assert.equal((await notifications(client.token)).items[0].type, 'CounterAccepted');

    // Новая цена водителя снимает встречную цену заказчика
    await api(ctx, 'POST', `/bids/${bid.id}/counter`, { token: client.token, body: { price: 43000 } });
    res = await api(ctx, 'PATCH', `/bids/${bid.id}`, { token: d1.token, body: { price: 44000 } });
    assert.deepEqual([res.data.myBid.price, res.data.myBid.counterPrice], [44000, null]);
    assert.equal((await notifications(client.token)).items[0].type, 'BidUpdated');

    res = await api(ctx, 'POST', `/bids/${bid.id}/accept`, { token: client.token });
    assert.equal(res.data.price, 44000, 'в заказ записана согласованная цена');
    assert.equal((await notifications(d1.token)).items[0].type, 'BidAccepted');
    assert.equal((await notifications(d2.token)).items[0].type, 'BidRejected');
  });

  test('уведомления: счётчик, прочтение, чужое уведомление недоступно', async () => {
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);
    const driver = await createVerifiedDriver(ctx);
    await api(ctx, 'POST', `/orders/${order.id}/bids`, { token: driver.token, body: { price: 40000 } });
    await api(ctx, 'POST', `/orders/${order.id}/cancel`, { token: client.token, body: { reason: 'Перенос' } });

    const driverPage = await notifications(driver.token);
    assert.equal(driverPage.items[0].type, 'OrderCancelled', 'водителю — об отмене заявки');

    let count = await api(ctx, 'GET', '/notifications/unread-count', { token: client.token });
    assert.equal(count.data.count, 1);
    const [note] = (await notifications(client.token)).items;

    assert.equal((await api(ctx, 'POST', `/notifications/${note.id}/read`, { token: driver.token })).statusCode, 403);
    assert.equal((await api(ctx, 'POST', `/notifications/${note.id}/read`, { token: client.token })).statusCode, 204);
    count = await api(ctx, 'GET', '/notifications/unread-count', { token: client.token });
    assert.equal(count.data.count, 0);

    assert.equal((await api(ctx, 'POST', '/notifications/read-all', { token: driver.token })).statusCode, 204);
    assert.equal((await notifications(driver.token)).unreadCount, 0);
    const unreadOnly = await api(ctx, 'GET', '/notifications?unreadOnly=true', { token: driver.token });
    assert.equal(unreadOnly.data.total, 0);
    assert.equal((await api(ctx, 'GET', '/notifications')).statusCode, 401);
  });

  test('проверка документов: администраторам — заявка на проверку, водителю — решение', async () => {
    const admin = await createAdmin(ctx);
    const driver = await registerUser(ctx, 'Driver');
    for (const doc of ['passport', 'license', 'sts']) {
      await api(ctx, 'PUT', `/users/me/documents/${doc}`, { token: driver.token, body: { imageBase64: TINY_JPEG } });
    }
    await api(ctx, 'POST', '/users/me/verification', { token: driver.token });
    const adminNote = (await notifications(admin.token)).items.find((n) => n.relatedUserId === driver.id);
    assert.equal(adminNote?.type, 'VerificationRequested');

    await api(ctx, 'PATCH', `/admin/users/${driver.id}`, {
      token: admin.token,
      body: { verificationStatus: 'verified' },
    });
    assert.equal((await notifications(driver.token)).items[0].type, 'VerificationResult');
  });
});

describe('Пароль', () => {
  test('смена пароля: проверка текущего, старые токены отзываются', async () => {
    const user = await registerUser(ctx, 'Client');
    const change = (body: Record<string, string>, token = user.token) =>
      api(ctx, 'POST', '/users/me/password', { token, body });

    let res = await change({
      currentPassword: 'Wrong1234',
      newPassword: 'Newpass123',
      newPasswordConfirm: 'Newpass123',
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.data.error.details[0].field, 'currentPassword');
    res = await change({ currentPassword: 'Secret123', newPassword: 'Newpass123', newPasswordConfirm: 'Other1234' });
    assert.equal(res.statusCode, 422);
    res = await change({ currentPassword: 'Secret123', newPassword: 'Secret123', newPasswordConfirm: 'Secret123' });
    assert.equal(res.statusCode, 422, 'новый пароль совпадает с текущим');

    res = await change({ currentPassword: 'Secret123', newPassword: 'Newpass123', newPasswordConfirm: 'Newpass123' });
    assert.equal(res.statusCode, 200);
    assert.ok(res.data.accessToken);
    assert.equal(JSON.stringify(res.data).includes('Newpass123'), false, 'пароль не возвращается');

    const old = await api(ctx, 'GET', '/users/me', { token: user.token });
    assert.equal(old.statusCode, 401, 'токен, выданный до смены пароля, больше не принимается');
    assert.equal(old.data.error.code, 'TOKEN_EXPIRED');
    assert.equal((await api(ctx, 'GET', '/users/me', { token: res.data.accessToken })).statusCode, 200);

    assert.equal(
      (await api(ctx, 'POST', '/auth/login', { body: { email: user.email, password: 'Secret123' } })).statusCode,
      401,
    );
    assert.equal(
      (await api(ctx, 'POST', '/auth/login', { body: { email: user.email, password: 'Newpass123' } })).statusCode,
      200,
    );
  });

  test('«Забыли пароль?»: просьба администратору → временный пароль', async () => {
    const admin = await createAdmin(ctx);
    const user = await registerUser(ctx, 'Driver');

    const unknown = await api(ctx, 'POST', '/auth/password-reset-request', { body: { email: 'nobody@test.ru' } });
    const known = await api(ctx, 'POST', '/auth/password-reset-request', { body: { email: user.email } });
    assert.equal(unknown.statusCode, 202);
    assert.equal(known.statusCode, 202);
    assert.equal(unknown.data.message, known.data.message, 'ответ не раскрывает, есть ли такой email');
    await api(ctx, 'POST', '/auth/password-reset-request', { body: { email: user.email } });

    let requests = (await notifications(admin.token)).items.filter(
      (n) => n.type === 'PasswordResetRequested' && n.relatedUserId === user.id,
    );
    assert.equal(requests.length, 1, 'повторная просьба не дублируется');

    assert.equal(
      (await api(ctx, 'POST', `/admin/users/${user.id}/temporary-password`, { token: user.token })).statusCode,
      403,
    );
    const issued = await api(ctx, 'POST', `/admin/users/${user.id}/temporary-password`, { token: admin.token });
    assert.equal(issued.statusCode, 200);
    const temporaryPassword: string = issued.data.temporaryPassword;
    assert.match(temporaryPassword, /^[a-z]{6}[0-9]{4}$/);

    assert.equal((await api(ctx, 'GET', '/users/me', { token: user.token })).statusCode, 401, 'сессии завершены');
    const login = await api(ctx, 'POST', '/auth/login', { body: { email: user.email, password: temporaryPassword } });
    assert.equal(login.statusCode, 200);

    requests = (await notifications(admin.token)).items.filter(
      (n) => n.type === 'PasswordResetRequested' && n.relatedUserId === user.id,
    );
    assert.equal(requests[0].isRead, true, 'просьба закрыта после выдачи пароля');
    const [row] = await ctx.orm.em.fork().execute<any[]>('select password_hash from users where id = ?', [user.id]);
    assert.match(row.password_hash, /^\$2[aby]\$12\$/, 'временный пароль тоже хранится только хешем');
  });
});
