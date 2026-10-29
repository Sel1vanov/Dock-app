import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { errorMessage } from '../core/errors';

export interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  /** Перезагрузка (pull-to-refresh). */
  refresh: () => Promise<void>;
  /** Тихая перезагрузка без индикатора — после действий пользователя. */
  reload: () => Promise<void>;
}

/**
 * Загрузка данных для экрана. Перезапрашивает данные при каждом возвращении на экран,
 * чтобы статусы заказов и отклики были актуальными. С pollMs, пока экран открыт и приложение
 * активно, данные тихо обновляются с этим интервалом — изменения другой стороны появляются сами.
 */
export function useQuery<T>(
  loader: (() => Promise<T>) | null,
  deps: unknown[],
  options: { pollMs?: number } = {},
): QueryState<T> {
  const [data, setData] = useState<T>();
  const [isLoading, setIsLoading] = useState(Boolean(loader));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  // Последняя версия загрузчика (замыкание с актуальными параметрами) — до запуска эффектов.
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });
  const requestId = useRef(0);

  // Параметры загрузки изменились → сразу показываем индикатор (корректировка состояния при рендере).
  const depsKey = JSON.stringify(deps);
  const [loadedKey, setLoadedKey] = useState(depsKey);
  if (loadedKey !== depsKey) {
    setLoadedKey(depsKey);
    setIsLoading(Boolean(loader));
  }

  /** Запрос к серверу; состояние меняется только после ответа (await). */
  const fetchData = useCallback(async () => {
    const load = loaderRef.current;
    if (!load) return;
    const id = ++requestId.current;
    try {
      const result = await load();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e));
    } finally {
      if (id === requestId.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const isFirstFocus = useRef(true);
  const { pollMs } = options;
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) isFirstFocus.current = false;
      else void fetchData();
      if (!pollMs) return undefined;
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void fetchData();
      }, pollMs);
      return () => clearInterval(timer);
    }, [fetchData, pollMs]),
  );

  const refresh = useCallback(async () => {
    if (!loaderRef.current) return;
    setIsRefreshing(true);
    await fetchData();
  }, [fetchData]);

  return { data, isLoading, isRefreshing, error, refresh, reload: fetchData };
}

export interface ActionState<A extends unknown[]> {
  run: (...args: A) => Promise<boolean>;
  isRunning: boolean;
  error: string | null;
  clearError: () => void;
}

/** Действие пользователя (мутация) с индикатором выполнения и текстом ошибки. */
export function useAction<A extends unknown[]>(action: (...args: A) => Promise<unknown>): ActionState<A> {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionRef = useRef(action);
  useLayoutEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args: A) => {
    setIsRunning(true);
    setError(null);
    try {
      await actionRef.current(...args);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { run, isRunning, error, clearError: useCallback(() => setError(null), []) };
}

export interface PagedQueryState<T> {
  items: T[];
  total: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  /** Догрузить следующую страницу (бесконечная прокрутка). */
  loadMore: () => void;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Постраничная загрузка с сервера (LIMIT/OFFSET): первая страница загружается при открытии
 * и при каждом изменении фильтров (deps), следующие — по мере прокрутки списка.
 */
export function usePagedQuery<P extends { items: { id: string }[]; total: number }>(
  loader: ((offset: number) => Promise<P>) | null,
  deps: unknown[],
): PagedQueryState<P['items'][number]> & { lastPage: P | undefined } {
  type T = P['items'][number];
  const [items, setItems] = useState<T[]>([]);
  const [lastPage, setLastPage] = useState<P>();
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(loader));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });
  const requestId = useRef(0);
  const loadingMore = useRef(false);

  const depsKey = JSON.stringify(deps);
  const [loadedKey, setLoadedKey] = useState(depsKey);
  if (loadedKey !== depsKey) {
    setLoadedKey(depsKey);
    setIsLoading(Boolean(loader));
  }

  /** Первая страница; состояние меняется только после ответа сервера. */
  const fetchFirst = useCallback(async () => {
    const load = loaderRef.current;
    if (!load) return;
    const id = ++requestId.current;
    try {
      const page = await load(0);
      if (id !== requestId.current) return;
      setItems(page.items);
      setTotal(page.total);
      setLastPage(page);
      setError(null);
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e));
    } finally {
      if (id === requestId.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  const loadedCount = items.length;
  const loadMore = useCallback(() => {
    const load = loaderRef.current;
    if (!load || loadingMore.current || loadedCount >= total) return;
    loadingMore.current = true;
    setIsLoadingMore(true);
    const id = requestId.current;
    load(loadedCount)
      .then((page) => {
        if (id !== requestId.current) return;
        setItems((prev) => {
          // Пока листали, могли появиться новые записи: убираем повторы по id.
          const known = new Set(prev.map((x) => x.id));
          return [...prev, ...page.items.filter((x) => !known.has(x.id))];
        });
        setTotal(page.total);
        setLastPage(page);
      })
      .catch((e) => {
        if (id === requestId.current) setError(errorMessage(e));
      })
      .finally(() => {
        loadingMore.current = false;
        setIsLoadingMore(false);
      });
  }, [loadedCount, total]);

  // Новые фильтры → первая страница заново (пока грузится, экран показывает индикатор).
  useEffect(() => {
    void fetchFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void fetchFirst();
    }, [fetchFirst]),
  );

  const refresh = useCallback(async () => {
    if (!loaderRef.current) return;
    setIsRefreshing(true);
    await fetchFirst();
  }, [fetchFirst]);

  return {
    items,
    total,
    lastPage,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore: items.length < total,
    error,
    loadMore,
    refresh,
    reload: fetchFirst,
  };
}

/** Значение, которое обновляется с задержкой — чтобы не отправлять запрос на каждую букву поиска. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
