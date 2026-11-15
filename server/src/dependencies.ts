// зависимости для обработчиков (как Depends() в fastapi):
//  - getSession(request)   - EntityManager этого запроса
//  - authenticate          - проверяет Bearer токен и грузит текущего юзера
//  - requireRole(...roles) - проверка роли
//  - services(request)     - сервисы поверх em этого запроса
//
// em создается на каждый запрос (orm.em.fork()) и между запросами не шарится:
// у каждого свой identity map и своя транзакция
import type { MikroORM } from '@mikro-orm/postgresql';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { Config } from './core/config.js';
import { ForbiddenError, UnauthorizedError } from './core/errors.js';
import { passwordVersion, verifyAccessToken } from './core/security.js';
import { User, type UserRole } from './models/index.js';
import { AdminService } from './services/AdminService.js';
import { AuthService } from './services/AuthService.js';
import { BidService } from './services/BidService.js';
import { CatalogService } from './services/CatalogService.js';
import type { ServiceContext } from './services/context.js';
import { DisputeService } from './services/DisputeService.js';
import type { FileStorage } from './services/FileStorage.js';
import { NotificationService } from './services/NotificationService.js';
import { OrderService } from './services/OrderService.js';
import { ReviewService } from './services/ReviewService.js';
import { TrackingService } from './services/TrackingService.js';
import { UserService } from './services/UserService.js';
import { VehicleService } from './services/VehicleService.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    storage: FileStorage;
  }
  interface FastifyRequest {
    em: EntityManager;
    currentUser: User | null;
    // когда юзер ввел пароль (unix сек), берется из токена. нужно для продления сессии
    sessionStartedAt: number;
  }
}

export function registerDependencies(
  app: FastifyInstance,
  deps: { orm: MikroORM; config: Config; storage: FileStorage },
) {
  app.decorate('config', deps.config);
  app.decorate('storage', deps.storage);
  app.decorateRequest('em', null as unknown as EntityManager);
  app.decorateRequest('currentUser', null);
  app.decorateRequest('sessionStartedAt', 0);
  // новый em на каждый запрос
  app.addHook('onRequest', async (request) => {
    request.em = deps.orm.em.fork();
  });
}

export function getSession(request: FastifyRequest): EntityManager {
  return request.em;
}

// проверяет Authorization: Bearer <JWT> (подпись, срок, issuer) и подгружает юзера
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new UnauthorizedError('Требуется авторизация: передайте токен в заголовке Authorization: Bearer');
  const payload = verifyAccessToken(request.server.config, match[1]);
  const user = await getSession(request).findOne(User, { id: payload.sub });
  if (!user) throw new UnauthorizedError('Пользователь не найден. Войдите снова');
  if (user.isBlocked) throw new ForbiddenError('Аккаунт заблокирован администратором');
  if (payload.pwv !== passwordVersion(user.passwordChangedAt)) {
    throw new UnauthorizedError('Пароль был изменён. Войдите снова', 'TOKEN_EXPIRED');
  }
  request.currentUser = user;
  request.sessionStartedAt = payload.sst;
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest): Promise<void> => {
    const user = currentUser(request);
    if (!roles.includes(user.role)) throw new ForbiddenError('Недостаточно прав для этого действия');
  };
}

export function currentUser(request: FastifyRequest): User {
  if (!request.currentUser) throw new UnauthorizedError();
  return request.currentUser;
}

// сервисы для обработчика, все работают с em текущего запроса
export function services(request: FastifyRequest) {
  const ctx: ServiceContext = {
    em: getSession(request),
    config: request.server.config,
    storage: request.server.storage,
  };
  return {
    auth: new AuthService(ctx),
    users: new UserService(ctx),
    vehicles: new VehicleService(ctx),
    orders: new OrderService(ctx),
    bids: new BidService(ctx),
    tracking: new TrackingService(ctx),
    reviews: new ReviewService(ctx),
    admin: new AdminService(ctx),
    catalog: new CatalogService(ctx),
    notifications: new NotificationService(ctx),
    disputes: new DisputeService(ctx),
  };
}
