import { type EntityManager, raw } from '@mikro-orm/postgresql';

import { Review, User, type UserRole, type VerificationStatus } from '../models/index.js';
import { likePattern } from './query.js';

export interface UserSearch {
  verificationStatus?: VerificationStatus;
  role?: UserRole;
  q?: string;
  limit: number;
  offset: number;
}

export interface RatingAggregate {
  average: number;
  count: number;
}

// пользователи (таблица users) и их рейтинг (агрегат по reviews)
export class UserRepository {
  constructor(private readonly em: EntityManager) {}

  findById(id: string): Promise<User | null> {
    return this.em.findOne(User, { id });
  }

  // для логина: password_hash ленивое поле и выбирается только тут
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.em.findOne(User, { email }, { populate: ['passwordHash'] });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.em.findOne(User, { email });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.em.count(User, { email })) > 0;
  }

  // занят ли телефон другим аккаунтом (exceptUserId - сам юзер, когда редактирует профиль)
  async existsByPhone(phone: string, exceptUserId?: string): Promise<boolean> {
    return (await this.em.count(User, { phone, ...(exceptUserId ? { id: { $ne: exceptUserId } } : {}) })) > 0;
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'role' | 'fullName' | 'phone'>): User {
    return this.em.create(User, data);
  }

  // поиск с фильтрами, сортировкой, LIMIT и OFFSET (для модерации)
  search(filter: UserSearch): Promise<[User[], number]> {
    const pattern = filter.q ? likePattern(filter.q) : null;
    return this.em.findAndCount(
      User,
      {
        ...(filter.verificationStatus ? { verificationStatus: filter.verificationStatus } : {}),
        ...(filter.role ? { role: filter.role } : {}),
        ...(pattern ? { $or: [{ fullName: { $ilike: pattern } }, { email: { $ilike: pattern } }] } : {}),
      },
      { orderBy: { updatedAt: 'desc', id: 'asc' }, limit: filter.limit, offset: filter.offset },
    );
  }

  // рейтинги сразу для всех юзеров на экране ОДНИМ запросом
  // SELECT target_id, avg(rating), count(*) ... WHERE target_id IN (...) GROUP BY target_id
  // а не по запросу на каждого (иначе N+1)
  async getRatings(userIds: string[]): Promise<Map<string, RatingAggregate>> {
    const ids = [...new Set(userIds)];
    const result = new Map<string, RatingAggregate>();
    if (ids.length === 0) return result;
    const rows = await this.em
      .createQueryBuilder(Review, 'r')
      .select(['r.target', raw('avg(r.rating) as average'), raw('count(*) as count')])
      .where({ target: { $in: ids } })
      .groupBy('r.target')
      .execute('all', false);
    for (const row of rows as unknown as Record<string, string>[]) {
      const targetId = row.target_id ?? row.target;
      result.set(targetId, { average: Math.round(Number(row.average) * 10) / 10, count: Number(row.count) });
    }
    return result;
  }
}
