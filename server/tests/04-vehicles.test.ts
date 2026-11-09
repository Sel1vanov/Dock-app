/** CRUD транспорта и связь N:M «ТС ↔ типы груза»; проверка владельца записи. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { type TestContext, api, registerUser, setupTestApp } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

const VEHICLE = {
  type: 'Manipulator',
  model: 'КАМАЗ с КМУ',
  maxWeightKg: 12000,
  lengthM: 8,
  widthM: 2.5,
  heightM: 3,
  cargoTypeCodes: ['Container', 'Equipment'],
};

describe('Транспорт водителя', () => {
  test('создание, чтение, изменение типов груза (N:M), удаление', async () => {
    const driver = await registerUser(ctx, 'Driver');
    const created = await api(ctx, 'POST', '/vehicles', { token: driver.token, body: VEHICLE });
    assert.equal(created.statusCode, 201);
    assert.deepEqual(created.data.cargoTypes.map((c: { code: string }) => c.code).sort(), ['Container', 'Equipment']);

    const updated = await api(ctx, 'PATCH', `/vehicles/${created.data.id}`, {
      token: driver.token,
      body: { cargoTypeCodes: ['Car'], maxWeightKg: 4000 },
    });
    assert.equal(updated.statusCode, 200);
    assert.deepEqual(updated.data.cargoTypes, [{ code: 'Car', name: 'Автомобиль' }]);
    const pivot = await ctx.orm.em
      .fork()
      .execute<any[]>('select cargo_type_code from vehicle_cargo_types where vehicle_id = ?', [created.data.id]);
    assert.deepEqual(
      pivot.map((r: { cargo_type_code: string }) => r.cargo_type_code),
      ['Car'],
      'промежуточная таблица обновлена',
    );

    const listed = await api(ctx, 'GET', '/vehicles', { token: driver.token });
    assert.equal(listed.data.length, 1);

    assert.equal((await api(ctx, 'DELETE', `/vehicles/${created.data.id}`, { token: driver.token })).statusCode, 204);
    const left = await ctx.orm.em.fork().execute<any[]>('select count(*)::int as n from vehicle_cargo_types');
    assert.equal(left[0].n, 0, 'строки связи удалены каскадно');
  });

  test('чужое ТС → 403, заказчику раздел недоступен → 403, неизвестный тип груза → 422', async () => {
    const owner = await registerUser(ctx, 'Driver');
    const other = await registerUser(ctx, 'Driver');
    const client = await registerUser(ctx, 'Client');
    const vehicle = (await api(ctx, 'POST', '/vehicles', { token: owner.token, body: VEHICLE })).data;

    assert.equal((await api(ctx, 'GET', `/vehicles/${vehicle.id}`, { token: other.token })).statusCode, 403);
    assert.equal(
      (await api(ctx, 'PATCH', `/vehicles/${vehicle.id}`, { token: other.token, body: { model: 'x' } })).statusCode,
      403,
    );
    assert.equal((await api(ctx, 'DELETE', `/vehicles/${vehicle.id}`, { token: other.token })).statusCode, 403);
    assert.equal((await api(ctx, 'GET', '/vehicles', { token: client.token })).statusCode, 403);
    const bad = await api(ctx, 'POST', '/vehicles', {
      token: owner.token,
      body: { ...VEHICLE, cargoTypeCodes: ['Rocket'] },
    });
    assert.equal(bad.statusCode, 422);
    const empty = await api(ctx, 'PATCH', `/vehicles/${vehicle.id}`, { token: owner.token, body: {} });
    assert.equal(empty.statusCode, 422);
  });
});
