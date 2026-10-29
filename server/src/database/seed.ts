/**
 * Начальные данные для демонстрации и ручной проверки (npm run db:seed).
 * Покрывают все статусы заказа, связи (отклики, встречную цену, фото, отзывы, ТС с типами грузов,
 * уведомления о событиях), фильтры и поиск, а также ошибочные сценарии: неверифицированный водитель,
 * водитель на проверке, заблокированный пользователь, закрытые заявки.
 *
 *   npm run db:seed            — заполнить пустую базу
 *   npm run db:seed -- --fresh — очистить все таблицы (кроме справочника) и заполнить заново
 *
 * Пароль у всех демо-пользователей: Dock12345
 */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import type { EntityManager } from '@mikro-orm/postgresql';

import { loadConfig, loadEnvFile } from '../core/config.js';
import { hashPassword } from '../core/security.js';
import {
  Bid,
  BidStatus,
  CargoType,
  DocumentType,
  Notification,
  NotificationType,
  Order,
  OrderPhoto,
  OrderStatus,
  PhotoStage,
  Review,
  User,
  UserRole,
  Vehicle,
  VehicleType,
  VerificationDocument,
  VerificationStatus,
} from '../models/index.js';
import { LocalFileStorage } from '../services/FileStorage.js';
import { initOrm } from './orm.js';

export const DEMO_PASSWORD = 'Dock12345';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 60 * 60 * 1000);

export async function seed(em: EntityManager, storage: LocalFileStorage): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const asset = (name: string) => readFile(resolve(import.meta.dirname, 'seed-assets', name));
  const cargo = async (code: string) => em.findOneOrFail(CargoType, { code });

  const saveFile = async (key: string, name: string) => {
    await storage.save(key, await asset(name));
    return key;
  };

  await em.transactional(async (tx) => {
    // ------------------------------------------------------------ пользователи
    const user = (data: Partial<User> & Pick<User, 'email' | 'fullName' | 'phone' | 'role'>) =>
      tx.create(User, { passwordHash, ...data });

    const admin = user({
      email: 'admin@dock.ru',
      fullName: 'Администратор Dock',
      phone: '+79990000001',
      role: UserRole.Admin,
    });
    const anna = user({
      email: 'client@dock.ru',
      fullName: 'Анна Смирнова',
      phone: '+79161234567',
      role: UserRole.Client,
    });
    const stroy = user({
      email: 'stroytech@dock.ru',
      fullName: 'Пётр Иванов (СтройТех)',
      phone: '+79037654321',
      role: UserRole.Client,
    });
    const ivan = user({
      email: 'driver@dock.ru',
      fullName: 'Иван Петров',
      phone: '+79261112233',
      role: UserRole.Driver,
      verificationStatus: VerificationStatus.Verified,
      verifiedAt: ago(20),
      verifiedBy: admin,
    });
    const sergey = user({
      email: 'driver2@dock.ru',
      fullName: 'Сергей Кузнецов',
      phone: '+79265556677',
      role: UserRole.Driver,
      verificationStatus: VerificationStatus.Pending,
    });
    const oleg = user({
      email: 'driver3@dock.ru',
      fullName: 'Олег Новиков',
      phone: '+79269998877',
      role: UserRole.Driver,
    });
    user({
      email: 'blocked@dock.ru',
      fullName: 'Заблокированный Пользователь',
      phone: '+79260000000',
      role: UserRole.Client,
      isBlocked: true,
    });

    // ------------------------------------------------------------- транспорт
    const [machinery, agricultural, equipment, car, container, other] = await Promise.all(
      ['Machinery', 'Agricultural', 'Equipment', 'Car', 'Container', 'Other'].map(cargo),
    );
    const trawl = tx.create(Vehicle, {
      driver: ivan,
      type: VehicleType.Trawl,
      model: 'МАЗ-6430 + трал ЧМЗАП',
      maxWeightKg: 30000,
      lengthM: 13.6,
      widthM: 3.2,
      heightM: 3.5,
    });
    trawl.cargoTypes.set([machinery, agricultural, equipment, other]);
    const tow = tx.create(Vehicle, {
      driver: ivan,
      type: VehicleType.TowTruck,
      model: 'ГАЗон Next эвакуатор',
      maxWeightKg: 4000,
      lengthM: 6.2,
      widthM: 2.4,
      heightM: 2.5,
    });
    tow.cargoTypes.set([car]);
    const manipulator = tx.create(Vehicle, {
      driver: sergey,
      type: VehicleType.Manipulator,
      model: 'КАМАЗ-65117 с КМУ',
      maxWeightKg: 12000,
      lengthM: 8,
      widthM: 2.5,
      heightM: 3,
    });
    manipulator.cargoTypes.set([container, equipment, other]);
    const flatbed = tx.create(Vehicle, {
      driver: oleg,
      type: VehicleType.Flatbed,
      model: 'Volvo FH бортовой',
      maxWeightKg: 20000,
      lengthM: 13.6,
      widthM: 2.45,
      heightM: 2.7,
    });
    flatbed.cargoTypes.set([equipment, container, other]);

    // ---------------------------------------------------------------- заявки
    const order = (
      data: Partial<Order> &
        Pick<
          Order,
          | 'client'
          | 'cargoType'
          | 'cargoWeightKg'
          | 'cargoLengthM'
          | 'cargoWidthM'
          | 'cargoHeightM'
          | 'originAddress'
          | 'destinationAddress'
          | 'price'
        >,
    ) => tx.create(Order, data);

    // Открытые заявки без откликов — разные типы, цены и даты (поиск, фильтр, сортировка, пагинация)
    order({
      client: anna,
      cargoType: machinery,
      description: 'Экскаватор-погрузчик JCB 3CX',
      cargoWeightKg: 8300,
      cargoLengthM: 6.9,
      cargoWidthM: 2.4,
      cargoHeightM: 3.1,
      originAddress: 'Москва, ул. Складочная, 1',
      destinationAddress: 'Тверь, Промышленная ул., 12',
      price: 45000,
      createdAt: ago(0, 3),
    });
    order({
      client: anna,
      cargoType: car,
      description: 'Toyota Land Cruiser 200, не на ходу',
      cargoWeightKg: 2700,
      cargoLengthM: 4.95,
      cargoWidthM: 1.98,
      cargoHeightM: 1.95,
      originAddress: 'Москва, Ленинградский пр-т, 39',
      destinationAddress: 'Санкт-Петербург, Кольцевая ул., 5',
      price: 38000,
      createdAt: ago(0, 6),
    });
    order({
      client: stroy,
      cargoType: agricultural,
      description: 'Трактор Беларус-1221 с отвалом',
      cargoWeightKg: 5300,
      cargoLengthM: 4.95,
      cargoWidthM: 2.3,
      cargoHeightM: 2.85,
      originAddress: 'Рязань, Ряжское ш., 20',
      destinationAddress: 'Тула, ул. Тимирязева, 99',
      price: 32000,
      createdAt: ago(1),
    });
    order({
      client: stroy,
      cargoType: equipment,
      description: 'Трансформатор ТМГ-1000, в обрешётке',
      cargoWeightKg: 3600,
      cargoLengthM: 2.2,
      cargoWidthM: 1.4,
      cargoHeightM: 2.1,
      originAddress: 'Подольск, ул. Комсомольская, 1',
      destinationAddress: 'Калуга, Грабцевское ш., 35',
      price: 27000,
      createdAt: ago(1, 5),
    });
    order({
      client: stroy,
      cargoType: machinery,
      description: 'Бульдозер Komatsu D155 (негабарит по ширине)',
      cargoWeightKg: 39500,
      cargoLengthM: 8.7,
      cargoWidthM: 4.1,
      cargoHeightM: 3.4,
      originAddress: 'Москва, МКАД 47-й км',
      destinationAddress: 'Ярославль, Пожарского ул., 6',
      price: 160000,
      createdAt: ago(2),
    });
    order({
      client: anna,
      cargoType: container,
      description: '20-футовый контейнер с оборудованием',
      cargoWeightKg: 9000,
      cargoLengthM: 6.06,
      cargoWidthM: 2.44,
      cargoHeightM: 2.59,
      originAddress: 'Москва, Ленинградское ш., 300',
      destinationAddress: 'Клин, ул. Чайковского, 50',
      price: 29000,
      createdAt: ago(3),
    });
    order({
      client: anna,
      cargoType: other,
      description: 'Модульная бытовка 6×2,4 м',
      cargoWeightKg: 2500,
      cargoLengthM: 6,
      cargoWidthM: 2.4,
      cargoHeightM: 2.5,
      originAddress: 'Химки, ул. Заводская, 2',
      destinationAddress: 'Дмитров, Внуковская ул., 1',
      price: 18000,
      createdAt: ago(4),
    });

    // Идёт торг: два отклика
    const bidding = order({
      client: anna,
      cargoType: machinery,
      description: 'Мини-экскаватор Hitachi ZX55',
      cargoWeightKg: 5200,
      cargoLengthM: 5.5,
      cargoWidthM: 1.9,
      cargoHeightM: 2.6,
      originAddress: 'Москва, ул. Верхние Поля, 18',
      destinationAddress: 'Серпухов, Северное ш., 10',
      price: 30000,
      status: OrderStatus.Bidding,
      createdAt: ago(0, 20),
    });
    // На отклик Ивана заказчица ответила встречной ценой
    tx.create(Bid, {
      order: bidding,
      driver: ivan,
      offeredPrice: 28000,
      counterPrice: 26000,
      comment: 'Могу забрать завтра утром',
      createdAt: ago(0, 18),
    });
    tx.create(Bid, { order: bidding, driver: oleg, offeredPrice: 33000, comment: null, createdAt: ago(0, 10) });

    // Исполнитель выбран, ожидает оплаты
    const assigned = order({
      client: stroy,
      cargoType: equipment,
      description: 'Дизельный генератор 200 кВт',
      cargoWeightKg: 4200,
      cargoLengthM: 3.6,
      cargoWidthM: 1.5,
      cargoHeightM: 2.2,
      originAddress: 'Москва, ул. Электродная, 2',
      destinationAddress: 'Владимир, Октябрьский пр-т, 3',
      price: 26000,
      status: OrderStatus.Assigned,
      driver: ivan,
      createdAt: ago(2, 4),
    });
    tx.create(Bid, {
      order: assigned,
      driver: ivan,
      offeredPrice: 26000,
      status: BidStatus.Accepted,
      createdAt: ago(2, 2),
    });

    // В пути: оплачено, есть фото погрузки
    const inTransit = order({
      client: anna,
      cargoType: agricultural,
      description: 'Комбайн Acros 595 (без жатки)',
      cargoWeightKg: 15500,
      cargoLengthM: 9.4,
      cargoWidthM: 3.1,
      cargoHeightM: 3.4,
      originAddress: 'Ростов-на-Дону, ул. Менжинского, 2',
      destinationAddress: 'Воронеж, Ленинский пр-т, 160',
      price: 85000,
      status: OrderStatus.InTransit,
      driver: ivan,
      isEscrowLocked: true,
      createdAt: ago(5),
    });
    tx.create(Bid, {
      order: inTransit,
      driver: ivan,
      offeredPrice: 85000,
      status: BidStatus.Accepted,
      createdAt: ago(4, 20),
    });

    // Завершён: фото погрузки и выгрузки, отзывы обеих сторон
    const completed = order({
      client: anna,
      cargoType: machinery,
      description: 'Каток Bomag BW 213',
      cargoWeightKg: 12800,
      cargoLengthM: 5.9,
      cargoWidthM: 2.3,
      cargoHeightM: 3,
      originAddress: 'Москва, Варшавское ш., 170',
      destinationAddress: 'Обнинск, Киевское ш., 59',
      price: 41000,
      status: OrderStatus.Completed,
      driver: ivan,
      createdAt: ago(12),
    });
    tx.create(Bid, {
      order: completed,
      driver: ivan,
      offeredPrice: 41000,
      status: BidStatus.Accepted,
      createdAt: ago(11, 20),
    });
    tx.create(Review, {
      order: completed,
      author: anna,
      target: ivan,
      rating: 5,
      comment: 'Аккуратно и вовремя, рекомендую',
      createdAt: ago(9),
    });
    tx.create(Review, {
      order: completed,
      author: ivan,
      target: anna,
      rating: 5,
      comment: 'Груз был готов к погрузке',
      createdAt: ago(9),
    });

    // Отменён с причиной
    order({
      client: stroy,
      cargoType: car,
      description: 'Газель Next, после ДТП',
      cargoWeightKg: 2900,
      cargoLengthM: 5.6,
      cargoWidthM: 2.07,
      cargoHeightM: 2.2,
      originAddress: 'Мытищи, Олимпийский пр-т, 13',
      destinationAddress: 'Королёв, ул. Пионерская, 4',
      price: 12000,
      status: OrderStatus.Cancelled,
      cancelReason: 'Отремонтировали на месте',
      createdAt: ago(7),
    });

    // ---------------------------------------------------------- уведомления
    // О событиях, которые уже есть в демо-данных выше: отклики, встречная цена, выбор исполнителя,
    // оплата, этапы рейса, приёмка, отзывы, проверка документов.
    const notice = (
      user: User,
      type: NotificationType,
      title: string,
      body: string,
      createdAt: Date,
      extra: { order?: Order; relatedUser?: User; isRead?: boolean } = {},
    ) =>
      tx.create(Notification, {
        user,
        type,
        title,
        body,
        createdAt,
        order: extra.order ?? null,
        relatedUser: extra.relatedUser ?? null,
        isRead: extra.isRead ?? false,
      });

    notice(
      anna,
      NotificationType.BidPlaced,
      'Новый отклик',
      'Иван Петров предлагает 28 000 ₽ за «Мини-экскаватор Hitachi ZX55».',
      ago(0, 18),
      { order: bidding },
    );
    notice(
      anna,
      NotificationType.BidPlaced,
      'Новый отклик',
      'Олег Новиков предлагает 33 000 ₽ за «Мини-экскаватор Hitachi ZX55».',
      ago(0, 10),
      { order: bidding },
    );
    notice(
      ivan,
      NotificationType.CounterOffer,
      'Встречная цена',
      'Заказчик предлагает 26 000 ₽ за «Мини-экскаватор Hitachi ZX55». Ваша цена — 28 000 ₽.',
      ago(0, 9),
      { order: bidding },
    );
    notice(
      ivan,
      NotificationType.BidAccepted,
      'Вас выбрали исполнителем',
      '«Дизельный генератор 200 кВт» за 26 000 ₽. Рейс можно начать после оплаты заказчиком.',
      ago(2, 2),
      { order: assigned },
    );
    notice(
      ivan,
      NotificationType.OrderPaid,
      'Заказ оплачен',
      '85 000 ₽ за «Комбайн Acros 595 (без жатки)» заморожены на безопасной сделке. Можно ехать на погрузку.',
      ago(4, 18),
      { order: inTransit, isRead: true },
    );
    notice(anna, NotificationType.TripStatus, 'Груз в пути', 'Заказ «Комбайн Acros 595 (без жатки)».', ago(1), {
      order: inTransit,
    });
    notice(
      ivan,
      NotificationType.OrderCompleted,
      'Приёмка подтверждена',
      'Заказчик принял груз «Каток Bomag BW 213», 41 000 ₽ переведены вам. Оцените заказчика.',
      ago(10),
      { order: completed, isRead: true },
    );
    notice(
      ivan,
      NotificationType.ReviewReceived,
      'Новый отзыв',
      'Анна Смирнова оценивает заказ «Каток Bomag BW 213» на 5 из 5.',
      ago(9),
      { order: completed, isRead: true },
    );
    notice(
      anna,
      NotificationType.ReviewReceived,
      'Новый отзыв',
      'Иван Петров оценивает заказ «Каток Bomag BW 213» на 5 из 5.',
      ago(9),
      { order: completed, isRead: true },
    );
    notice(
      ivan,
      NotificationType.VerificationResult,
      'Документы подтверждены',
      'Теперь вы можете откликаться на заявки.',
      ago(20),
      { isRead: true },
    );
    notice(
      admin,
      NotificationType.VerificationRequested,
      'Документы на проверку',
      'Водитель Сергей Кузнецов загрузил паспорт, ВУ и СТС и ждёт проверки.',
      ago(0, 5),
      { relatedUser: sergey },
    );

    await tx.flush(); // id заказов известны — сохраняем файлы с правильными ключами

    for (const [o, stage, name, at] of [
      [inTransit, PhotoStage.Loading, 'loading.jpg', ago(1)],
      [completed, PhotoStage.Loading, 'loading.jpg', ago(11)],
      [completed, PhotoStage.Unloading, 'unloading.jpg', ago(10)],
    ] as const) {
      tx.create(OrderPhoto, {
        order: o,
        stage,
        fileKey: await saveFile(`orders/${o.id}/${stage.toLowerCase()}/${randomUUID()}.jpg`, name),
        uploadedAt: at,
      });
    }

    // Документы водителей (Иван — подтверждён, Сергей — на проверке)
    for (const driver of [ivan, sergey]) {
      for (const docType of Object.values(DocumentType)) {
        tx.create(VerificationDocument, {
          user: driver,
          docType,
          fileKey: await saveFile(`documents/${driver.id}/${docType}-${randomUUID()}.jpg`, `${docType}.jpg`),
        });
      }
    }
  });
}

/** Удаляет данные всех таблиц, кроме справочника типов груза. */
export async function truncateData(em: EntityManager): Promise<void> {
  await em.execute(
    'truncate table "notifications", "reviews", "order_photos", "bids", "orders", "vehicle_cargo_types", "vehicles", "verification_documents", "users" restart identity cascade',
  );
}

// Запуск из командной строки
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  loadEnvFile();
  const config = loadConfig();
  const orm = await initOrm(config);
  const em = orm.em.fork();
  try {
    if (process.argv.includes('--fresh')) {
      await truncateData(em);
      console.log('Таблицы очищены');
    } else if ((await em.count(User, {})) > 0) {
      console.log('В базе уже есть пользователи — пропускаю. Для пересоздания: npm run db:seed -- --fresh');
      process.exit(0);
    }
    await seed(em, new LocalFileStorage(config.FILES_DIR));
    console.log(`Демо-данные созданы. Пароль всех пользователей: ${DEMO_PASSWORD}`);
    console.log(
      '  admin@dock.ru · client@dock.ru · stroytech@dock.ru · driver@dock.ru · driver2@dock.ru · driver3@dock.ru',
    );
  } catch (e) {
    console.error('Не удалось заполнить базу:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await orm.close();
  }
}
