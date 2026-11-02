import { UniqueConstraintViolationException } from '@mikro-orm/core';

import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import {
  ACTIVE_TRIP_STATUSES,
  DisputeStatus,
  NotificationType,
  type OrderStatus,
  OrderStatus as Status,
  type User,
} from '../models/index.js';
import { DisputeRepository, NotificationRepository, OrderRepository } from '../repositories/index.js';
import type { AdminDisputesQueryT, DisputeOpenInput, DisputeResolveInput } from '../schemas/disputes.js';
import type { ServiceContext } from './context.js';
import { toAdminDisputeResponse } from './mappers.js';
import { NotificationService, orderTitle, rub } from './NotificationService.js';
import { OrderService } from './OrderService.js';

const ALREADY_OPEN = 'По этому заказу уже открыт спор — дождитесь решения администратора';

/**
 * Споры (UC-20, UC-21). Пока спор открыт, заказ в статусе Disputed: рейс приостановлен,
 * средства остаются замороженными. Администратор решает спор:
 *  - в пользу заказчика — заказ отменяется, замороженные средства возвращаются заказчику;
 *  - в пользу водителя — заказ завершается, средства переводятся водителю.
 */
export class DisputeService {
  private readonly disputes: DisputeRepository;
  private readonly orders: OrderRepository;
  private readonly notifications: NotificationService;

  constructor(private readonly ctx: ServiceContext) {
    this.disputes = new DisputeRepository(ctx.em);
    this.orders = new OrderRepository(ctx.em);
    this.notifications = new NotificationService(ctx);
  }

  /** UC-20: заказчик или назначенный водитель открывает спор после оплаты и до приёмки груза. */
  async open(user: User, orderId: string, input: DisputeOpenInput) {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError('Заявка не найдена');
    const isClient = order.client.id === user.id;
    const isDriver = order.driver?.id === user.id;
    if (!isClient && !isDriver) throw new ForbiddenError('Спор открывают только заказчик и водитель этого заказа');
    if (order.status === Status.Disputed) throw new ConflictError(ALREADY_OPEN);
    const isActiveTrip = (ACTIVE_TRIP_STATUSES as readonly OrderStatus[]).includes(order.status);
    if (!isActiveTrip || !order.isEscrowLocked) {
      throw new ConflictError('Спор можно открыть после оплаты заказа и до подтверждения приёмки');
    }

    this.disputes.create({ order, openedBy: user, reason: input.reason, orderStatusAtOpen: order.status });
    order.status = Status.Disputed;

    const counterpart = isClient ? order.driver! : order.client;
    const who = isClient ? 'Заказчик' : 'Водитель';
    this.notifications.notify(
      counterpart,
      NotificationType.DisputeOpened,
      'Открыт спор',
      `${who} ${user.fullName} открыл спор по заказу ${orderTitle(order)}: «${input.reason}». Рейс приостановлен до решения администратора.`,
      { order },
    );
    await this.notifications.notifyAdmins(
      NotificationType.DisputeOpened,
      'Новый спор',
      `${who} ${user.fullName}: «${input.reason}» — заказ ${orderTitle(order)}, ${rub(order.price)}.`,
      { order },
    );
    try {
      await this.ctx.em.flush(); // INSERT спора, UPDATE заказа и уведомления — одна транзакция
    } catch (e) {
      // Два участника открыли спор одновременно: второй отклоняет частичный уникальный индекс
      if (e instanceof UniqueConstraintViolationException) throw new ConflictError(ALREADY_OPEN);
      throw e;
    }
    return new OrderService(this.ctx).getDetails(user, order.id);
  }

  /** Очередь администратора. */
  async list(query: AdminDisputesQueryT) {
    const [items, total] = await this.disputes.list(query);
    return { items: items.map(toAdminDisputeResponse), total, limit: query.limit, offset: query.offset };
  }

  /**
   * UC-21: решение администратора — одна транзакция с явными commit/rollback. Строка спора блокируется
   * (SELECT … FOR UPDATE): если два администратора решают спор одновременно, второй дождётся первого
   * и получит 409. Спор, заказ, деньги и уведомления меняются вместе или не меняются вовсе.
   */
  async resolve(admin: User, disputeId: string, input: DisputeResolveInput) {
    const em = this.ctx.em;
    await em.begin();
    try {
      const dispute = await this.decide(admin, disputeId, input);
      await em.flush();
      // Уведомления «Новый спор» у всех администраторов больше не требуют внимания
      await new NotificationRepository(em).markReadByOrder(dispute.order.id, NotificationType.DisputeOpened);
      await em.commit();
      return toAdminDisputeResponse(dispute);
    } catch (e) {
      await em.rollback();
      throw e;
    }
  }

  private async decide(admin: User, disputeId: string, input: DisputeResolveInput) {
    if (!(await this.disputes.lockById(disputeId))) throw new NotFoundError('Спор не найден');
    const dispute = (await this.disputes.findById(disputeId))!;
    if (dispute.status !== DisputeStatus.Open) throw new ConflictError('Спор уже решён');

    const { order } = dispute;
    const forClient = input.status === DisputeStatus.ResolvedClient;
    dispute.status = input.status;
    dispute.resolutionComment = input.resolutionComment;
    dispute.resolvedBy = admin;
    dispute.resolvedAt = new Date();

    order.isEscrowLocked = false;
    if (forClient) {
      order.status = Status.Cancelled;
      order.cancelReason = `Спор решён в пользу заказчика: ${input.resolutionComment}`.slice(0, 300);
    } else {
      order.status = Status.Completed;
    }

    const outcome = forClient
      ? `в пользу заказчика: ${rub(order.price)} возвращены заказчику, заказ отменён`
      : `в пользу водителя: ${rub(order.price)} переведены водителю, заказ завершён`;
    for (const party of [order.client, order.driver!]) {
      this.notifications.notify(
        party,
        NotificationType.DisputeResolved,
        'Спор решён',
        `По заказу ${orderTitle(order)} спор решён ${outcome}. Комментарий: ${input.resolutionComment}`,
        { order },
      );
    }
    return dispute;
  }
}
