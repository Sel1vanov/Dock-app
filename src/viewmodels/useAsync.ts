import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * чтобы статусы заказов и отклики были актуальными.
 */
export function useQuery<T>(loader: (() => Promise<T>) | null, deps: unknown[]): QueryState<T> {
  const [data, setData] = useState<T>();
  const [isLoading, setIsLoading] = useState(Boolean(loader));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const requestId = useRef(0);

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const load = loaderRef.current;
    if (!load) return;
    const id = ++requestId.current;
    if (mode === 'initial') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
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
    setData(undefined);
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void run('silent');
    }, [run]),
  );

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refresh: useCallback(() => run('refresh'), [run]),
    reload: useCallback(() => run('silent'), [run]),
  };
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
  actionRef.current = action;

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
