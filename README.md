<div align="center">

# 🚛 Dock

**Мобильное приложение для перевозки негабаритных грузов**

Заказчик публикует заявку с габаритами груза, водители со спецтехникой предлагают цену,
сделка проходит безопасно — с заморозкой оплаты и обязательной фотофиксацией рейса.

![Expo](https://img.shields.io/badge/Expo_SDK-58-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=black)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)

</div>

---

## ✨ Возможности

- 📦 **Заявки** — габариты, вес, тип груза, маршрут; водитель видит только подходящие его технике
- 💬 **Торг** — отклик с ценой водителя и встречная цена заказчика
- 🔒 **Безопасная сделка** — оплата замораживается и переводится после приёмки груза
- 📸 **Рейс с фотофиксацией** — статусы погрузки, пути и выгрузки
- 🛡️ **Модерация** — проверка документов водителей, блокировка, решение споров
- 🔔 **Уведомления, отзывы, связь** — звонок, WhatsApp и Telegram с контрагентом

## 🧱 Архитектура

```
Мобильное приложение  ──HTTPS + JWT──▶  Dock API  ──ORM──▶  PostgreSQL
Expo / React Native                      Fastify              Docker
iOS · Android · Web                      /api/v1, /docs
```

| Часть | Папка | Технологии |
|---|---|---|
| Клиент | `src/` | TypeScript, React Native, Expo Router, MVVM |
| Сервер | `server/src/` | TypeScript, Fastify, MikroORM, zod, JWT, Swagger |
| База данных | `server/src/database/`, `docker-compose.yml` | PostgreSQL 17, миграции |

## 🚀 Быстрый запуск

Нужны **Node.js 22.17+** и запущенный **Docker Desktop**.

```bash
npm install     # один раз: зависимости клиента и сервера, server/.env со случайными секретами
npm run dev     # каждый раз: база + миграции + сервер + клиент
```

`npm run dev` сам поднимет PostgreSQL в Docker, применит миграции, зальёт демо-данные в пустую базу,
запустит API и Expo. Откройте приложение по QR-коду в **Expo Go** (телефон в той же Wi-Fi сети)
или нажмите **w** — откроется браузер. **Ctrl+C** останавливает всё.

Документация API (Swagger): <http://localhost:8000/docs>

## 🔧 Запуск по частям

| Шаг | Команда |
|---|---|
| **База данных** — запустить PostgreSQL в Docker | `docker compose up -d` |
| **Миграции** — применить / откатить / статус | `npm --prefix server run db:migrate` · `db:migrate:down` · `db:status` |
| **Демо-данные** — залить / пересоздать | `npm --prefix server run db:seed` · `npm run db:reset` |
| **Сервер** — API на порту 8000 | `npm run server` |
| **Клиент** — Expo | `npm start` (`npm run web` — сразу в браузере) |

Адрес сервера клиент определяет сам. Если API запущен на другом компьютере, задайте его в `.env` в корне:
`EXPO_PUBLIC_API_URL=http://192.168.1.10:8000` (образец — `.env.example`).

Остановить базу: `docker compose stop`. Удалить вместе с данными: `docker compose down -v`.
Выгрузка и загрузка базы: `npm run db:dump` / `npm run db:restore`.

## 👤 Демо-пользователи

Пароль у всех — **`Dock12345`**

| Email | Роль |
|---|---|
| `client@dock.ru` | Заказчик |
| `stroytech@dock.ru` | Заказчик (есть открытый спор) |
| `driver@dock.ru` | Водитель, проверен |
| `driver2@dock.ru` | Водитель, документы на проверке |
| `driver3@dock.ru` | Водитель, без верификации |
| `admin@dock.ru` | Администратор |
| `blocked@dock.ru` | Заблокированный пользователь |

Вернуть демо-данные в исходное состояние: `npm run db:reset`.

## 🩺 Если что-то не запускается

| Проблема | Решение |
|---|---|
| «PostgreSQL не запустился» | Запустите Docker Desktop, дождитесь статуса *Running*, повторите `npm run dev` |
| Порт 5432 занят | Остановите установленный на компьютере PostgreSQL либо смените порт в `docker-compose.yml` и `DATABASE_URL` в `server/.env` |
| Порт 8000 занят | Закройте программу на этом порту (часто — предыдущий запуск сервера) |
| «Неверный email или пароль» у демо-пользователя | Данные в базе менялись — `npm run db:reset` |
| Expo Go: «project is incompatible» | Обновите Expo Go: проект на Expo SDK 58 |
| Приложение не видит сервер | Телефон и компьютер в одной Wi-Fi сети (не гостевой); брандмауэр пропускает порты 8081 и 8000 |
| Нет файла `server/.env` | `npm --prefix server run env:init` |
| Нужна полностью чистая база | `docker compose down -v`, затем `npm run dev` |

## 📁 Структура

```
├── src/                 мобильное приложение (MVVM)
│   ├── app/             маршруты Expo Router
│   ├── views/           экраны и компоненты
│   ├── viewmodels/      состояние экранов, проверка форм
│   ├── services/        сценарии поверх репозиториев
│   ├── repositories/    HTTP-запросы к API
│   ├── models/          типы, схемы форм, доменные правила
│   └── core/            HTTP-клиент, токен, конфигурация
├── server/src/          Dock API
│   ├── routers/         маршруты /api/v1/…
│   ├── services/        бизнес-правила и права доступа
│   ├── repositories/    доступ к данным через ORM
│   ├── models/          ORM-модели
│   ├── schemas/         схемы запросов и ответов (zod)
│   ├── database/        подключение, миграции, демо-данные
│   └── core/            конфигурация, безопасность, ошибки
├── scripts/dev.mjs      запуск всего проекта одной командой
└── docker-compose.yml   PostgreSQL 17
```
