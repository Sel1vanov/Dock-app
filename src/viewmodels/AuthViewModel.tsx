import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { errorMessage } from '../core/errors';
import type { UserDTO } from '../models/dto';
import { type FieldErrors, type SignUpInput, signInSchema, signUpSchema, validate } from '../models/schemas';
import { AuthService } from '../services/AuthService';

interface AuthContextValue {
  session: Session | null;
  currentUser: UserDTO | null;
  /** Последний вошедший пользователь — нужен экранам, которые ещё видны во время выхода из аккаунта. */
  lastKnownUser: UserDTO | null;
  /** Идёт восстановление сессии при запуске приложения. */
  isInitializing: boolean;
  /** Ошибка загрузки профиля (например, аккаунт заблокирован). */
  profileError: string | null;
  refreshUser: () => Promise<void>;
  setCurrentUser: (user: UserDTO) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthViewModel (SAD 5.2): состояние аутентификации всего приложения —
 * currentUser, isLoading, errorMessage. Сессия хранится Supabase Auth в AsyncStorage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<UserDTO | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const userIdRef = useRef<string | null>(null);
  const lastUserRef = useRef<UserDTO | null>(null);
  if (currentUser) lastUserRef.current = currentUser;

  const loadUser = useCallback(async (next: Session | null) => {
    setSession(next);
    userIdRef.current = next?.user.id ?? null;
    if (!next) {
      setCurrentUser(null);
      return;
    }
    try {
      setCurrentUser(await AuthService.loadCurrentUser(next));
      setProfileError(null);
    } catch (e) {
      setCurrentUser(null);
      setProfileError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange сразу присылает текущую сессию (INITIAL_SESSION), затем — входы/выходы.
    // Запросы к Supabase внутри колбэка выполняем отложенно, как рекомендует документация supabase-js.
    let initialized = false;
    const unsubscribe = AuthService.onSessionChange((next) => {
      setTimeout(() => {
        const isSameUser = initialized && (next?.user.id ?? null) === userIdRef.current;
        if (isSameUser) {
          setSession(next); // обновился только токен
          return;
        }
        void loadUser(next).finally(() => {
          initialized = true;
          setIsInitializing(false);
        });
      }, 0);
    });
    return unsubscribe;
  }, [loadUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      currentUser,
      lastKnownUser: currentUser ?? lastUserRef.current,
      isInitializing,
      profileError,
      refreshUser: () => loadUser(session),
      setCurrentUser,
      signOut: AuthService.signOut,
    }),
    [session, currentUser, isInitializing, profileError, loadUser],
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

const EMPTY_FORM: SignUpInput = { email: '', password: '', fullName: '', phone: '', role: 'Client' };

/** ViewModel экрана входа/регистрации (AuthScreen). */
export function useAuthFormViewModel() {
  const { profileError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [values, setValues] = useState<SignUpInput>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<SignUpInput>>({});
  const [errorMessageText, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setField = <K extends keyof SignUpInput>(key: K, value: SignUpInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFieldErrors({});
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const submit = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
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
      if (mode === 'signIn') {
        await AuthService.signIn(checked.data);
      } else {
        const result = await AuthService.signUp(checked.data as SignUpInput);
        if (result.status === 'confirm-email') {
          setInfoMessage('Мы отправили письмо со ссылкой для подтверждения. После подтверждения войдите.');
          setMode('signIn');
        }
      }
      // При успешном входе AuthProvider получит новую сессию и корневой layout откроет приложение.
    } catch (e) {
      setErrorMessage(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    mode,
    values,
    fieldErrors,
    errorMessage: errorMessageText ?? profileError,
    infoMessage,
    isLoading,
    setField,
    switchMode,
    submit,
  };
}
