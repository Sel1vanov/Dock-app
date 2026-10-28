import type { AdminUserDTO, Page, UserDTO, UserRole, VerificationStatus } from '../models/dto';
import { toAdminUserDTO, toUserDTO } from '../models/mappers';
import { AdminRepository } from '../repositories/AdminRepository';

export const ADMIN_PAGE_SIZE = 15;

/** Модерация: проверка документов водителей (UC-02) и блокировка (UC-22). */
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

  async setBlocked(id: string, isBlocked: boolean): Promise<AdminUserDTO> {
    return toAdminUserDTO(await AdminRepository.updateUser(id, { isBlocked }));
  },
};
