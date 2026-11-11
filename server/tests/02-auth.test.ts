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
    const phones = [
      ['89161234561', '+79161234561'],
      ['9161234562', '+79161234562'],
      ['7 916 123 45 63', '+79161234563'],
      ['8 (916) 123-45-64', '+79161234564'],
    ];
    for (const [i, [phone, stored]] of phones.entries()) {
      const res = await api(ctx, 'POST', '/auth/register', { body: { ...VALID, email: `phone${i}@mail.ru`, phone } });
      assert.equal(res.statusCode, 201, phone);
      assert.equal(res.data.user.phone, stored, phone);
    }
  });

  test('повторная регистрация с тем же email → 409', async () => {
    const res = await api(ctx, 'POST', '/auth/register', { body: { ...VALID, email: 'NEW.USER@mail.ru' } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.data.error.code, 'CONFLICT');
  });

  test('один телефон — один аккаунт: тот же номер в любом написании → 409 с указанием поля', async () => {
    for (const phone of ['+7 (999) 123-45-67', '89991234567', '9991234567']) {
      const res = await api(ctx, 'POST', '/auth/register', { body: { ...VALID, email: 'other@mail.ru', phone } });
      assert.equal(res.statusCode, 409, phone);
      assert.deepEqual(
        res.data.error.details.map((d: { field: string }) => d.field),
        ['phone'],
      );
    }
    const rows = await ctx.orm.em.fork().execute<any[]>(`select count(*)::int as n from users where email = ?`, [
      'other@mail.ru',
    ]);
    assert.equal(rows[0].n, 0, 'аккаунт не создан');
  });

  test('заблокированный пользователь не заведёт второй аккаунт ни на свой email, ни на свой телефон', async () => {
    const banned = await registerUser(ctx, 'Client', { email: 'banned@mail.ru', phone: '+79035550011' });
    await ctx.orm.em.fork().nativeUpdate(User, { id: banned.id }, { isBlocked: true });

    const sameEmail = await api(ctx, 'POST', '/auth/register', {
      body: { ...VALID, email: 'Banned@Mail.ru', phone: '+79035550012' },
    });
    assert.equal(sameEmail.statusCode, 409, 'тот же email');
    assert.equal(sameEmail.data.error.details[0].field, 'email');

    const samePhone = await api(ctx, 'POST', '/auth/register', {
      body: { ...VALID, email: 'banned-again@mail.ru', phone: '8 (903) 555-00-11' },
    });
    assert.equal(samePhone.statusCode, 409, 'тот же телефон с другим email');
    assert.equal(samePhone.data.error.details[0].field, 'phone');
  });

  test('служебные имена запрещены: «Администратор», Support, аdmin, adm1n и т. п. → 422', async () => {
    const reserved = [
      'admin',
      'Администратор',
      'Админ Dock',
      'аdmin', // русская «а»
      'adm1n',
      'ad_min',
      'a d m i n',
      'Support',
      'Поддержка',
      'Техподдержка Dock',
      'Модератор Иван',
      'Служба безопасности',
      'Гарант сделки',
      'Иван Петров (поддержка)',
    ];
    for (const [i, fullName] of reserved.entries()) {
      const res = await api(ctx, 'POST', '/auth/register', {
        body: { ...VALID, email: `reserved${i}@mail.ru`, phone: `+7903777${String(i).padStart(4, '0')}`, fullName },
      });
      assert.equal(res.statusCode, 422, fullName);
      assert.equal(res.data.error.details[0].field, 'fullName', fullName);
    }
    // Обычные имена, похожие на запрещённые слова только частью букв, проходят
    for (const [i, fullName] of ['Влад Минин', 'Евдокия Ботова', 'John Murdock', 'Пётр Иванов (СтройТех)'].entries()) {
      const res = await api(ctx, 'POST', '/auth/register', {
        body: { ...VALID, email: `allowed${i}@mail.ru`, phone: `+7903888${String(i).padStart(4, '0')}`, fullName },
      });
      assert.equal(res.statusCode, 201, fullName);
    }
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

  test('продление сессии: по действующему токену выдаётся новый, начало сессии сохраняется', async () => {
    const user = await registerUser(ctx, 'Client');
    const first = jwt.decode(user.token) as jwt.JwtPayload;
    await new Promise((resolve) => setTimeout(resolve, 1100)); // чтобы у нового токена было другое время выдачи

    const res = await api(ctx, 'POST', '/auth/refresh', { token: user.token });
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.user.id, user.id);
    assert.notEqual(res.data.accessToken, user.token);
    const renewed = jwt.decode(res.data.accessToken) as jwt.JwtPayload;
    assert.ok((renewed.exp ?? 0) > (first.exp ?? 0), 'срок действия отодвинут');
    assert.equal(renewed.sst, first.sst, 'начало сессии переносится в новый токен');
    assert.equal((await api(ctx, 'GET', '/users/me', { token: res.data.accessToken })).statusCode, 200);

    assert.equal((await api(ctx, 'POST', '/auth/refresh')).statusCode, 401, 'без токена продлить нельзя');
  });

  test('сессия не продлевается: истёкший токен, блокировка, слишком давний вход по паролю', async () => {
    const user = await registerUser(ctx, 'Client');
    const sign = (claims: object, expiresIn: number) =>
      jwt.sign({ role: 'Client', pwv: 0, ...claims }, ctx.config.JWT_SECRET, {
        subject: user.id,
        issuer: 'dock-api',
        audience: 'dock-app',
        expiresIn,
      });

    const expired = await api(ctx, 'POST', '/auth/refresh', { token: sign({}, -10) });
    assert.equal(expired.statusCode, 401, 'истёкший токен продлить нельзя — нужен вход');

    const now = Math.floor(Date.now() / 1000);
    const tooOld = await api(ctx, 'POST', '/auth/refresh', {
      token: sign({ sst: now - ctx.config.SESSION_MAX_AGE - 60 }, 600),
    });
    assert.equal(tooOld.statusCode, 401);
    assert.equal(tooOld.data.error.code, 'TOKEN_EXPIRED', 'пароль вводили больше SESSION_MAX_AGE назад');

    await ctx.orm.em.fork().nativeUpdate(User, { id: user.id }, { isBlocked: true });
    assert.equal((await api(ctx, 'POST', '/auth/refresh', { token: user.token })).statusCode, 403);
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
