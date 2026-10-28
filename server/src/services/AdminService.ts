import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import { type User, UserRole, VerificationStatus } from '../models/index.js';
import { DocumentRepository, UserRepository, VehicleRepository } from '../repositories/index.js';
import type { AdminUserUpdateInput, AdminUsersQueryT } from '../schemas/admin.js';
import type { ServiceContext } from './context.js';
import { toDocumentResponse, toUserResponse, toVehicleResponse } from './mappers.js';

/** Модерация: проверка документов водителей (UC-02) и блокировка пользователей (UC-22). */
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
    }
    if (input.isBlocked !== undefined) user.isBlocked = input.isBlocked;
    await this.ctx.em.flush();
    return this.getUser(user.id);
  }
}
