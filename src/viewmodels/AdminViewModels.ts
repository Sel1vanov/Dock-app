/** Модерация (роль Admin): проверка документов водителей, блокировка пользователей, споры. */
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '../core/errors';
import { confirmAction, notify } from '../core/platform';
import { showToast } from '../core/toast';
import type { AdminUserDTO, UserRole, VerificationStatus } from '../models/dto';
import { AdminService } from '../services/AdminService';
import { useDebouncedValue, usePagedQuery, useQuery } from './useAsync';

export type ModerationFilter = 'pending' | 'drivers' | 'clients' | 'all';

const FILTERS: Record<ModerationFilter, { verificationStatus?: VerificationStatus; role?: UserRole }> = {
  pending: { verificationStatus: 'pending' },
  drivers: { role: 'Driver' },
  clients: { role: 'Client' },
  all: {},
};

export function useModerationViewModel() {
  const [filter, setFilter] = useState<ModerationFilter>('pending');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const list = usePagedQuery(
    (offset) => AdminService.listUsers({ ...FILTERS[filter], q: q || undefined }, offset),
    [filter, q],
  );
  return {
    ...list,
    filter,
    setFilter,
    search,
    setSearch,
    openUser: (id: string) => router.push(`/admin/user/${id}`),
  };
}

/** Очередь споров (UC-21): «Ждут решения» или все; карточка спора — экран заявки. */
export function useDisputeQueueViewModel() {
  const [onlyOpen, setOnlyOpen] = useState(true);
  const list = usePagedQuery((offset) => AdminService.listDisputes(onlyOpen ? 'Open' : undefined, offset), [onlyOpen]);
  // Счётчик на вкладке «Споры» — сколько ждут решения, при любом выбранном фильтре
  const openTotal = useQuery(onlyOpen ? null : () => AdminService.listDisputes('Open', 0).then((p) => p.total), [
    onlyOpen,
    list.total,
  ]);
  return {
    ...list,
    onlyOpen,
    setOnlyOpen,
    openCount: onlyOpen ? list.total : (openTotal.data ?? 0),
    openOrder: (orderId: string) => router.push(`/order/${orderId}`),
  };
}

export function useAdminUserViewModel(userId: string) {
  const query = useQuery(() => AdminService.getUser(userId), [userId]);
  const [busy, setBusy] = useState(false);
  /** Выданный временный пароль: показывается на экране, пока администратор диктует его по телефону. */
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const run = async (fn: () => Promise<AdminUserDTO>, success: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(success);
      await query.reload();
    } catch (e) {
      notify('Не получилось', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return {
    query,
    user: query.data,
    busy,
    temporaryPassword,
    /** «Забыли пароль?»: новый пароль сообщается пользователю по телефону, его прежние сессии завершаются. */
    issueTemporaryPassword: async () => {
      const ok = await confirmAction(
        'Выдать временный пароль?',
        'Старый пароль перестанет действовать, пользователь выйдет на всех устройствах. Сообщите новый пароль по телефону из профиля.',
        'Выдать',
      );
      if (!ok) return;
      setBusy(true);
      try {
        setTemporaryPassword(await AdminService.issueTemporaryPassword(userId));
      } catch (e) {
        notify('Не получилось', errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    approve: async () => {
      if (
        await confirmAction('Подтвердить документы?', 'Водитель получит доступ к откликам на заявки', 'Подтвердить')
      ) {
        await run(() => AdminService.decide(userId, 'verified'), 'Документы подтверждены');
      }
    },
    reject: async () => {
      if (await confirmAction('Отклонить документы?', 'Водитель сможет загрузить их заново', 'Отклонить')) {
        await run(() => AdminService.decide(userId, 'rejected'), 'Документы отклонены');
      }
    },
    toggleBlock: async () => {
      const user = query.data;
      if (!user) return;
      const block = !user.isBlocked;
      const ok = await confirmAction(
        block ? 'Заблокировать пользователя?' : 'Разблокировать пользователя?',
        block ? 'Пользователь не сможет войти и пользоваться приложением' : 'Доступ к приложению будет восстановлен',
        block ? 'Заблокировать' : 'Разблокировать',
      );
      if (ok)
        await run(
          () => AdminService.setBlocked(userId, block),
          block ? 'Пользователь заблокирован' : 'Пользователь разблокирован',
        );
    },
  };
}
