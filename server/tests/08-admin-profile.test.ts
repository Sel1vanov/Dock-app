/** Проверка прав по ролям (Admin), верификация водителя (UC-01, UC-02), профиль. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { type TestContext, TINY_JPEG, api, createAdmin, registerUser, setupTestApp } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

describe('Верификация водителя и модерация', () => {
  test('водитель загружает документы → отправляет на проверку → администратор подтверждает', async () => {
    const driver = await registerUser(ctx, 'Driver');
    const admin = await createAdmin(ctx);

    let res = await api(ctx, 'POST', '/users/me/verification', { token: driver.token });
    assert.equal(res.statusCode, 409, 'без документов отправить нельзя');

    for (const doc of ['passport', 'license', 'sts']) {
      res = await api(ctx, 'PUT', `/users/me/documents/${doc}`, {
        token: driver.token,
        body: { imageBase64: TINY_JPEG },
      });
      assert.equal(res.statusCode, 201);
    }
    res = await api(ctx, 'PUT', '/users/me/documents/passport', {
      token: driver.token,
      body: { imageBase64: TINY_JPEG },
    });
    assert.equal(res.statusCode, 200, 'повторная загрузка заменяет документ');
    assert.equal(
      (await api(ctx, 'PUT', '/users/me/documents/diploma', { token: driver.token, body: { imageBase64: TINY_JPEG } }))
        .statusCode,
      422,
    );

    res = await api(ctx, 'POST', '/users/me/verification', { token: driver.token });
    assert.equal(res.data.verificationStatus, 'pending');

    // Водитель не может сам себя подтвердить — 403 на административном API
    assert.equal(
      (
        await api(ctx, 'PATCH', `/admin/users/${driver.id}`, {
          token: driver.token,
          body: { verificationStatus: 'verified' },
        })
      ).statusCode,
      403,
    );

    const queue = await api(ctx, 'GET', '/admin/users?verificationStatus=pending', { token: admin.token });
    assert.equal(queue.statusCode, 200);
    assert.deepEqual(
      queue.data.items.map((u: { id: string }) => u.id),
      [driver.id],
    );

    const card = await api(ctx, 'GET', `/admin/users/${driver.id}`, { token: admin.token });
    assert.equal(card.data.documents.length, 3);

    res = await api(ctx, 'PATCH', `/admin/users/${driver.id}`, {
      token: admin.token,
      body: { verificationStatus: 'verified' },
    });
    assert.equal(res.data.verificationStatus, 'verified');
    const [row] = await ctx.orm.em.fork().execute<any[]>('select verified_by_id from users where id = ?', [driver.id]);
    assert.equal(row.verified_by_id, admin.id);
  });

  test('клиенту документы и модерация недоступны; администратора нельзя заблокировать', async () => {
    const client = await registerUser(ctx, 'Client');
    const admin = await createAdmin(ctx);
    const otherAdmin = await createAdmin(ctx);
    assert.equal((await api(ctx, 'GET', '/users/me/documents', { token: client.token })).statusCode, 403);
    assert.equal((await api(ctx, 'GET', '/admin/users', { token: client.token })).statusCode, 403);
    assert.equal(
      (await api(ctx, 'PATCH', `/admin/users/${otherAdmin.id}`, { token: admin.token, body: { isBlocked: true } }))
        .statusCode,
      403,
    );
    const blocked = await api(ctx, 'PATCH', `/admin/users/${client.id}`, {
      token: admin.token,
      body: { isBlocked: true },
    });
    assert.equal(blocked.data.isBlocked, true);
    assert.equal((await api(ctx, 'GET', '/users/me', { token: client.token })).statusCode, 403);
  });

  test('профиль: изменение имени и телефона, лишние поля запрещены', async () => {
    const user = await registerUser(ctx, 'Client');
    const res = await api(ctx, 'PATCH', '/users/me', {
      token: user.token,
      body: { fullName: 'Мария Иванова', phone: '+7 916 000-11-22' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.phone, '+79160001122');
    const escalation = await api(ctx, 'PATCH', '/users/me', { token: user.token, body: { role: 'Admin' } });
    assert.equal(escalation.statusCode, 422, 'роль через профиль не меняется');
    assert.equal((await api(ctx, 'GET', '/users/me', { token: user.token })).data.role, 'Client');
  });
});
