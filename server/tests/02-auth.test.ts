/**
 * Кейс 6: регистрация, вход, хеширование, JWT со сроком действия, 401/403/409/422,
 * отсутствие пароля и хеша в ответах.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import jwt from 'jsonwebtoken';

import { User } from '../src/models/index.js';
import { type TestContext, api, registerUser, setupTestApp } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setupTestApp();
});
after(() => ctx.close());

const VALID = {
  email: 'New.User@Mail.ru',
  password: 'Secret123',
  passwordConfirm: 'Secret123',
  fullName: 'Новый Пользователь',
  phone: '+7 (999) 123-45-67',
  role: 'Client',
};

describe('Регистрация и вход', () => {
  test('регистрация → 201, токен; пароль хранится только в виде bcrypt-хеша', async () => {
    const res = await api(ctx, 'POST', '/auth/register', { body: VALID });
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.tokenType, 'Bearer');
    assert.equal(res.data.user.email, 'new.user@mail.ru', 'email приводится к нижнему регистру');
    assert.equal(res.data.user.phone, '+79991234567', 'телефон нормализуется');
    assert.ok(!('password' in res.data.user) && !('passwordHash' in res.data.user));
    assert.ok(!res.body.includes('Secret123'));

    const rows = await ctx.orm.em
      .fork()
      .execute<any[]>('select password_hash from users where email = ?', ['new.user@mail.ru']);
    assert.match(rows[0].password_hash, /^\$2[aby]\$12\$/, 'bcrypt с cost 12');
  });

  test('телефон в любом привычном виде сохраняется как +7 и 10 цифр', async () => {
    for (const [i, phone] of ['89161234567', '9161234567', '7 916 123 45 67', '8 (916) 123-45-67'].entries()) {
      const res = await api(ctx, 'POST', '/auth/register', { body: { ...VALID, email: `phone${i}@mail.ru`, phone } });
      assert.equal(res.statusCode, 201, phone);
      assert.equal(res.data.user.phone, '+79161234567', phone);
    }
  });

  test('повторная регистрация с тем же email → 409', async () => {
    const res = await api(ctx, 'POST', '/auth/register', { body: { ...VALID, email: 'NEW.USER@mail.ru' } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.data.error.code, 'CONFLICT');
  });

  test('некорректные данные → 422 с ошибками по полям', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ ...VALID, email: 'not-an-email' }, 'email'],
      [{ ...VALID, password: 'short1', passwordConfirm: 'short1' }, 'password'],
      [{ ...VALID, email: 'x1@mail.ru', passwordConfirm: 'Other123' }, 'passwordConfirm'],
      [{ ...VALID, email: 'x2@mail.ru', role: 'Admin' }, 'role'],
      [{ ...VALID, email: 'x3@mail.ru', fullName: undefined }, 'fullName'],
      [{ ...VALID, email: 'x4@mail.ru', phone: '1234567890' }, 'phone'],
      [{ ...VALID, email: 'x5@mail.ru', phone: '916123456' }, 'phone'],
      [{ ...VALID, email: 'x6@mail.ru', phone: '+380441234567' }, 'phone'],
      [{ ...VALID, email: 'x7@mail.ru', phone: '+7 916 abc 123-45-67' }, 'phone'],
    ];
    for (const [body, field] of cases) {
      const res = await api(ctx, 'POST', '/auth/register', { body });
      assert.equal(res.statusCode, 422, `поле ${field}`);
      assert.ok(
        res.data.error.details.some((d: { field: string }) => d.field === field),
        `ошибка для ${field}`,
      );
    }
  });

  test('вход: верный пароль → 200, неверный → 401 без уточнения, что именно не так', async () => {
    const ok = await api(ctx, 'POST', '/auth/login', { body: { email: VALID.email, password: VALID.password } });
    assert.equal(ok.statusCode, 200);
    const decoded = jwt.decode(ok.data.accessToken) as jwt.JwtPayload;
    assert.equal((decoded.exp ?? 0) - (decoded.iat ?? 0), 3600, 'токен живёт ограниченное время');

    const wrongPassword = await api(ctx, 'POST', '/auth/login', {
      body: { email: VALID.email, password: 'Wrong1234' },
    });
    const unknownEmail = await api(ctx, 'POST', '/auth/login', {
      body: { email: 'nobody@mail.ru', password: 'Wrong1234' },
    });
    assert.equal(wrongPassword.statusCode, 401);
    assert.equal(unknownEmail.statusCode, 401);
    assert.equal(wrongPassword.data.error.message, unknownEmail.data.error.message);
  });
});

describe('Защита эндпоинтов токеном', () => {
  test('без токена, с поддельным и с чужой подписью → 401', async () => {
    assert.equal((await api(ctx, 'GET', '/users/me')).statusCode, 401);
    assert.equal((await api(ctx, 'GET', '/users/me', { token: 'garbage' })).statusCode, 401);
    const forged = jwt.sign({ role: 'Admin' }, 'another-secret-another-secret-0123', {
      subject: '00000000-0000-0000-0000-000000000000',
      issuer: 'dock-api',
      audience: 'dock-app',
    });
    assert.equal((await api(ctx, 'GET', '/users/me', { token: forged })).statusCode, 401);
  });

  test('истёкший токен → 401 TOKEN_EXPIRED', async () => {
    const user = await registerUser(ctx, 'Client');
    const expired = jwt.sign({ role: 'Client' }, ctx.config.JWT_SECRET, {
      subject: user.id,
      issuer: 'dock-api',
      audience: 'dock-app',
      expiresIn: -10,
    });
    const res = await api(ctx, 'GET', '/users/me', { token: expired });
    assert.equal(res.statusCode, 401);
    assert.equal(res.data.error.code, 'TOKEN_EXPIRED');
  });

  test('с действующим токеном профиль доступен; в ответе нет хеша пароля', async () => {
    const user = await registerUser(ctx, 'Driver');
    const res = await api(ctx, 'GET', '/users/me', { token: user.token });
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.id, user.id);
    assert.ok(!/password|hash/i.test(res.body));
  });

  test('заблокированный пользователь: вход и запросы с прежним токеном → 403', async () => {
    const user = await registerUser(ctx, 'Client');
    await ctx.orm.em.fork().nativeUpdate(User, { id: user.id }, { isBlocked: true });
    assert.equal((await api(ctx, 'GET', '/users/me', { token: user.token })).statusCode, 403);
    const login = await api(ctx, 'POST', '/auth/login', { body: { email: user.email, password: 'Secret123' } });
    assert.equal(login.statusCode, 403);
  });

  test('ответы об ошибках не раскрывают внутренние детали сервера', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": broken json',
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(JSON.parse(res.body)), ['error']);
    assert.ok(!/stack|at \w+ \(|SyntaxError|select |insert /i.test(res.body));
  });
});
