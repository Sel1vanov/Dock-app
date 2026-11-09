/**
 * Кейс 3: схема разворачивается на пустой БД только миграциями, совпадает с ORM-моделями,
 * откатывается и накатывается повторно; ограничения БД отклоняют некорректные данные сами.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  CheckConstraintViolationException,
  ForeignKeyConstraintViolationException,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';

import { type TestContext, createOrder, registerUser, setupTestApp } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

describe('Миграции и ограничения PostgreSQL', () => {
  test('на пустой базе применены все пять миграций, схема совпадает с моделями ORM', async () => {
    const executed = await ctx.orm.migrator.getExecuted();
    assert.deepEqual(
      executed.map((m) => m.name),
      [
        'Migration20261028100000_initial_schema',
        'Migration20261028110000_verification_and_search',
        'Migration20261029100000_notifications_and_bargaining',
        'Migration20261029120000_phone_format',
        'Migration20261103100000_disputes',
      ],
    );
    const tables = await ctx.orm.em
      .fork()
      .execute<{ table_name: string }[]>(
        `select table_name from information_schema.tables where table_schema = 'public' and table_name <> 'mikro_orm_migrations' order by 1`,
      );
    assert.equal(tables.length, 11);
    assert.equal((await ctx.orm.schema.getUpdateSchemaSQL()).replace("set names 'utf8';", '').trim(), '');
  });

  test('миграции откатываются и применяются повторно без ручных правок', async () => {
    await ctx.orm.migrator.down({ to: 0 });
    assert.equal((await ctx.orm.migrator.getExecuted()).length, 0);
    await ctx.orm.migrator.up();
    assert.equal((await ctx.orm.migrator.getExecuted()).length, 5);
    const cargoTypes = await ctx.orm.em.fork().execute<any[]>('select code from cargo_types');
    assert.equal(cargoTypes.length, 6, 'справочник типов груза заполнен миграцией');
  });

  test('CHECK, UNIQUE и FOREIGN KEY отклоняют некорректные данные на уровне БД', async () => {
    const em = ctx.orm.em.fork();
    const client = await registerUser(ctx, 'Client');
    const order = await createOrder(ctx, client.token);

    await assert.rejects(
      em.execute(`update orders set price = -1 where id = ?`, [order.id]),
      CheckConstraintViolationException,
      'цена должна быть больше нуля',
    );
    await assert.rejects(
      em.execute(`update orders set status = 'Loading' where id = ?`, [order.id]),
      CheckConstraintViolationException,
      'рейс без водителя и оплаты невозможен',
    );
    await assert.rejects(
      em.execute(`update users set phone = '89161234567' where id = ?`, [client.id]),
      CheckConstraintViolationException,
      'телефон хранится только в виде +7 и 10 цифр',
    );
    await assert.rejects(
      em.execute(
        `insert into users (email, password_hash, full_name, phone) values (?, 'x', 'Дубликат', '+79990000000')`,
        [client.email],
      ),
      UniqueConstraintViolationException,
    );
    await assert.rejects(
      em.execute(`delete from users where id = ?`, [client.id]),
      ForeignKeyConstraintViolationException,
      'заказчика с заявками удалить нельзя (RESTRICT)',
    );
  });
});
