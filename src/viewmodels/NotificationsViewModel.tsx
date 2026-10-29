/**
 * Уведомления: счётчик непрочитанных для колокольчика (опрашивается раз в 30 секунд, пока
 * приложение открыто) и экран списка уведомлений. Когда приходит новое уведомление,
 * его заголовок коротко показывается поверх экрана.
 */
import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { errorMessage } from '../core/errors';
import { notify } from '../core/platform';
import { showToast } from '../core/toast';
import type { NotificationDTO } from '../models/dto';
import { NotificationService } from '../services/NotificationService';
import { useAuth, useCurrentUser } from './AuthViewModel';
import { usePagedQuery } from './useAsync';

const POLL_MS = 30_000;

interface NotificationsContextValue {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  refreshUnread: async () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;
  const [unreadCount, setUnreadCount] = useState(0);
  // Другой пользователь вошёл — счётчик прежнего не показываем (корректировка состояния при рендере).
  const [countedFor, setCountedFor] = useState(userId);
  if (countedFor !== userId) {
    setCountedFor(userId);
    setUnreadCount(0);
  }
  /** Предыдущее значение счётчика: null — ещё не загружали (при входе подсказку не показываем). */
  const previous = useRef<number | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await NotificationService.getUnreadCount();
      if (previous.current !== null && count > previous.current) {
        const latest = await NotificationService.getLatest();
        if (latest && !latest.isRead) showToast(latest.title, 'info');
      }
      previous.current = count;
      setUnreadCount(count);
    } catch {
      // Нет сети или сессия истекла — счётчик обновится при следующей проверке.
    }
  }, [userId]);

  useEffect(() => {
    previous.current = null;
    if (!userId) return;
    const first = setTimeout(() => void refreshUnread(), 0);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshUnread();
    }, POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnread();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      subscription.remove();
    };
  }, [userId, refreshUnread]);

  const value = useMemo(() => ({ unreadCount, refreshUnread }), [unreadCount, refreshUnread]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useUnreadCount(): NotificationsContextValue {
  return useContext(NotificationsContext);
}

/** Экран «Уведомления»: список страницами, переход к заявке, отметка о прочтении. */
export function useNotificationsViewModel() {
  const user = useCurrentUser();
  const { unreadCount, refreshUnread } = useUnreadCount();
  const list = usePagedQuery((offset) => NotificationService.getPage(offset), [user.id]);
  /** Прочитанные в этом сеансе экрана — чтобы точка «новое» исчезала сразу после нажатия. */
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const open = async (n: NotificationDTO) => {
    if (!n.isRead && !readIds.has(n.id)) {
      setReadIds((prev) => new Set(prev).add(n.id));
      NotificationService.markRead(n.id)
        .then(refreshUnread)
        .catch(() => {});
    }
    const route = NotificationService.targetRoute(n, user.role);
    if (route) router.push(route as never);
  };

  const markAllRead = async () => {
    try {
      await NotificationService.markAllRead();
      setReadIds(new Set(list.items.map((n) => n.id)));
      await Promise.all([refreshUnread(), list.reload()]);
    } catch (e) {
      notify('Не получилось', errorMessage(e));
    }
  };

  return {
    ...list,
    unreadCount,
    isRead: (n: NotificationDTO) => n.isRead || readIds.has(n.id),
    open,
    markAllRead,
    refresh: async () => {
      await Promise.all([list.refresh(), refreshUnread()]);
    },
  };
}
