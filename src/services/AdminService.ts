import type {
  AdminDisputeDTO,
  AdminUserDTO,
  DisputeStatus,
  Page,
  UserDTO,
  UserRole,
  VerificationStatus,
} from '../models/dto';
import { toAdminUserDTO, toUserDTO } from '../models/mappers';
import { AdminRepository } from '../repositories/AdminRepository';

export const ADMIN_PAGE_SIZE = 15;

/** Модерация: проверка документов водителей (UC-02), блокировка (UC-22), споры (UC-21). */
export const AdminService = {
  async listUsers(
    filter: { verificationStatus?: VerificationStatus; role?: UserRole; q?: string },
    offset: number,
  ): Promise<Page<UserDTO>> {
    const page = await AdminRepository.listUsers({ ...filter, limit: ADMIN_PAGE_SIZE, offset });
    return { items: page.items.map(toUserDTO), total: page.total };
  },

  async getUser(id: string): Promise<AdminUserDTO> {
    return toAdminUserDTO(await AdminRepository.getUser(id));
  },

  async decide(id: string, decision: 'verified' | 'rejected'): Promise<AdminUserDTO> {
    return toAdminUserDTO(await AdminRepository.updateUser(id, { verificationStatus: decision }));
  },

  async issueTemporaryPassword(id: string): Promise<string> {
    return (await AdminRepository.issueTemporaryPassword(id)).temporaryPassword;
  },

  async setBlocked(id: string, isBlocked: boolean): Promise<AdminUserDTO> {
    return toAdminUserDTO(await AdminRepository.updateUser(id, { isBlocked }));
  },

  async listDisputes(status: DisputeStatus | undefined, offset: number): Promise<Page<AdminDisputeDTO>> {
    const page = await AdminRepository.listDisputes({ status, limit: ADMIN_PAGE_SIZE, offset });
    return { items: page.items, total: page.total };
  },

  /** UC-21: в пользу заказчика — возврат и отмена; в пользу водителя — выплата и завершение. */
  async resolveDispute(id: string, inFavorOf: 'client' | 'driver', comment: string): Promise<AdminDisputeDTO> {
    return AdminRepository.resolveDispute(id, {
      status: inFavorOf === 'client' ? 'ResolvedClient' : 'ResolvedDriver',
      resolutionComment: comment.trim(),
    });
  },
};
