import { randomInt } from 'node:crypto';

import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import { hashPassword } from '../core/security.js';
import { NotificationType, type User, UserRole, VerificationStatus } from '../models/index.js';
import {
  DocumentRepository,
  NotificationRepository,
  UserRepository,
  VehicleRepository,
} from '../repositories/index.js';
import type { AdminUserUpdateInput, AdminUsersQueryT } from '../schemas/admin.js';
import type { ServiceContext } from './context.js';
import { toDocumentResponse, toUserResponse, toVehicleResponse } from './mappers.js';
import { NotificationService } from './NotificationService.js';

/** Без похожих символов (0/O, 1/l/I), чтобы пароль было легко продиктовать по телефону. */
const LETTERS = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';

/** Временный пароль: 6 букв и 4 цифры — проходит правила пароля (есть буква и цифра, 10 символов). */
export function generateTemporaryPassword(): string {
  const pick = (alphabet: string, n: number) =>
    Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `${pick(LETTERS, 6)}${pick(DIGITS, 4)}`;
}

/** Модерация: проверка документов водителей (UC-02), блокировка (UC-22), временный пароль. */
export class AdminService {
  private readonly users: UserRepository;
  private readonly documents: DocumentRepository;
  private readonly vehicles: VehicleRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.users = new UserRepository(ctx.em);
    this.documents = new DocumentRepository(ctx.em);
    this.vehicles = new VehicleRepository(ctx.em);
  }

  async listUsers(query: AdminUsersQueryT) {
    const [users, total] = await this.users.search(query);
    const ratings = await this.users.getRatings(users.map((u) => u.id));
    return {
      items: users.map((u) => toUserResponse(u, ratings.get(u.id) ?? null)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getUser(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Пользователь не найден');
    const [ratings, documents, vehicles] = await Promise.all([
      this.users.getRatings([user.id]),
      this.documents.listByUser(user.id),
      user.role === UserRole.Driver ? this.vehicles.listByDriver(user.id) : Promise.resolve([]),
    ]);
    return {
      ...toUserResponse(user, ratings.get(user.id) ?? null),
      documents: documents.map((d) => toDocumentResponse(d, this.ctx.config)),
      vehicles: vehicles.map(toVehicleResponse),
    };
  }

  async updateUser(admin: User, id: string, input: AdminUserUpdateInput) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Пользователь не найден');
    if (user.role === UserRole.Admin) throw new ForbiddenError('Учётные записи администраторов здесь не изменяются');

    if (input.verificationStatus) {
      if (user.role !== UserRole.Driver || user.verificationStatus !== VerificationStatus.Pending) {
        throw new ConflictError('Решение принимается только по документам водителя, отправленным на проверку');
      }
      user.verificationStatus = input.verificationStatus;
      user.verifiedAt = new Date();
      user.verifiedBy = admin;
      const verified = input.verificationStatus === VerificationStatus.Verified;
      new NotificationService(this.ctx).notify(
        user,
        NotificationType.VerificationResult,
        verified ? 'Документы подтверждены' : 'Документы отклонены',
        verified ? 'Теперь вы можете откликаться на заявки.' : 'Загрузите документы заново и отправьте их на проверку.',
      );
    }
    if (input.isBlocked !== undefined) user.isBlocked = input.isBlocked;
    await this.ctx.em.flush();
    return this.getUser(user.id);
  }

  /**
   * «Забыли пароль?»: администратор выдаёт временный пароль и сообщает его пользователю по телефону.
   * Все прежние сессии пользователя завершаются; просьбы о сбросе у администраторов закрываются.
   */
  async issueTemporaryPassword(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Пользователь не найден');
    if (user.role === UserRole.Admin) throw new ForbiddenError('Учётные записи администраторов здесь не изменяются');
    const temporaryPassword = generateTemporaryPassword();
    user.passwordHash = await hashPassword(temporaryPassword);
    user.passwordChangedAt = new Date();
    await this.ctx.em.flush();
    await new NotificationRepository(this.ctx.em).markResetRequestsRead(user.id);
    return { temporaryPassword };
  }
}
