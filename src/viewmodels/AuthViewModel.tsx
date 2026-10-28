import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { onUnauthorized } from '../core/api';
import { ApiError, errorMessage } from '../core/errors';
import { tokenStorage } from '../core/tokenStorage';
import type { UserDTO } from '../models/dto';
import { type FieldErrors, type SignUpForm, signInSchema, signUpSchema, validate } from '../models/schemas';
import { AuthService } from '../services/AuthService';

interface AuthContextValue {
  currentUser: UserDTO | null;
  /** Последний вошедший пользователь — нужен экранам, которые ещё видны во время выхода из аккаунта. */
  lastKnownUser: UserDTO | null;
  /** Идёт восстановление сессии при запуске приложения. */
  isInitializing: boolean;
  /** Почему пользователь оказался на экране входа: сессия истекла, аккаунт заблокирован, нет сети. */
  sessionMessage: string | null;
  refreshUser: () => Promise<void>;
  setCurrentUser: (user: UserDTO) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthViewModel (SAD 5.2): состояние аутентификации всего приложения.
 * JWT хранится в защищённом хранилище устройства; при 401 от сервера (токен истёк
 * или аккаунт удалён) токен удаляется, и пользователь возвращается на экран входа.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<UserDTO | null>(null);
  /** Последний вошедший пользователь — не сбрасывается при выходе (см. lastKnownUser). */
  const [lastKnownUser, setLastKnownUser] = useState<UserDTO | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const setCurrentUser = useCallback((user: UserDTO | null) => {
    setCurrentUserState(user);
    if (user) setLastKnownUser(user);
  }, []);

  const endSession = useCallback(
    async (message: string | null) => {
      await tokenStorage.remove();
      setCurrentUser(null);
      setSessionMessage(message);
    },
    [setCurrentUser],
  );

  const loadUser = useCallback(async () => {
    try {
      setCurrentUser(await AuthService.loadCurrentUser());
      setSessionMessage(null);
    } catch (e) {
      // 401 обработает onUnauthorized; 403 — аккаунт заблокирован: токен больше не нужен.
      if (e instanceof ApiError && e.status === 403) await endSession(e.message);
      else if (!(e instanceof ApiError && e.status === 401)) setSessionMessage(errorMessage(e));
    }
  }, [endSession, setCurrentUser]);

  useEffect(() => {
    onUnauthorized((reason) => void endSession(reason));
    void (async () => {
      if (await AuthService.hasToken()) await loadUser();
      setIsInitializing(false);
    })();
    return () => onUnauthorized(null);
  }, [loadUser, endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      lastKnownUser: currentUser ?? lastKnownUser,
      isInitializing,
      sessionMessage,
      refreshUser: loadUser,
      setCurrentUser: (user) => {
        setSessionMessage(null);
        setCurrentUser(user);
      },
      signOut: async () => {
        await AuthService.signOut();
        setCurrentUser(null);
        setSessionMessage(null);
      },
    }),
    [currentUser, lastKnownUser, isInitializing, sessionMessage, loadUser, setCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вызван вне AuthProvider');
  return ctx;
}

/** Пользователь на экранах, доступных только после входа. */
export function useCurrentUser(): UserDTO {
  const { lastKnownUser } = useAuth();
  if (!lastKnownUser) throw new Error('Экран доступен только авторизованному пользователю');
  return lastKnownUser;
}

export type AuthMode = 'signIn' | 'signUp';

const EMPTY_FORM: SignUpForm = {
  email: '',
  password: '',
  passwordConfirm: '',
  fullName: '',
  phone: '',
  role: 'Client',
};

/** ViewModel экрана входа/регистрации (AuthScreen). */
export function useAuthFormViewModel() {
  const { sessionMessage, setCurrentUser } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [values, setValues] = useState<SignUpForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<SignUpForm>>({});
  const [errorMessageText, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  /** Сообщение «сессия истекла» показываем, пока пользователь не начал новое действие. */
  const [showSessionMessage, setShowSessionMessage] = useState(true);

  const setField = <K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setShowSessionMessage(false);
    setFieldErrors({});
    setErrorMessage(null);
  };

  const submit = async () => {
    setErrorMessage(null);
    setShowSessionMessage(false);
    // Проверка обязательных полей и формата до отправки запроса.
    const checked =
      mode === 'signIn'
        ? validate(signInSchema, { email: values.email, password: values.password })
        : validate(signUpSchema, values);
    if (!checked.ok) {
      setFieldErrors(checked.errors);
      return;
    }
    setIsLoading(true);
    try {
      const user =
        mode === 'signIn'
          ? await AuthService.signIn(checked.data)
          : await AuthService.signUp(checked.data as Parameters<typeof AuthService.signUp>[0]);
      setValues(EMPTY_FORM);
      setCurrentUser(user); // корневой layout сам откроет приложение
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) setFieldErrors(e.fieldErrors);
      setErrorMessage(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    mode,
    values,
    fieldErrors,
    errorMessage: errorMessageText ?? (showSessionMessage ? sessionMessage : null),
    isLoading,
    setField,
    switchMode,
    submit,
  };
}
