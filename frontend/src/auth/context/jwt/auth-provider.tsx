import { useEffect, useReducer, useCallback, useMemo } from 'react';

import { fetchCurrentUser, fetchLogin, fetchLogout } from 'src/auth/api/auth-requests';
import {
  ACCESS_TOKEN_KEY,
  AUTH_USER_KEY,
  REMEMBER_ME_KEY,
  REFRESH_TOKEN_KEY,
  getRememberMe,
  getStoredToken,
} from 'src/auth/api/storage-keys';
import type { LoginRequest, TokenPairResponse } from 'src/auth/api/types';

import { AuthContext } from './auth-context';
import { isValidToken, setSession } from './utils';
import { buildMockAuthUser, createMockAccessToken, isJwtAuthMock } from './mock-auth';
import { ActionMapType, AuthStateType, AuthUserType } from '../../types';

// ----------------------------------------------------------------------

enum Types {
  INITIAL = 'INITIAL',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

type Payload = {
  [Types.INITIAL]: {
    user: AuthUserType;
  };
  [Types.LOGIN]: {
    user: AuthUserType;
  };
  [Types.LOGOUT]: undefined;
};

type ActionsType = ActionMapType<Payload>[keyof ActionMapType<Payload>];

// ----------------------------------------------------------------------

const initialState: AuthStateType = {
  user: null,
  loading: true,
};

const reducer = (state: AuthStateType, action: ActionsType) => {
  if (action.type === Types.INITIAL) {
    return {
      loading: false,
      user: action.payload.user,
    };
  }
  if (action.type === Types.LOGIN) {
    return {
      ...state,
      user: action.payload.user,
    };
  }
  if (action.type === Types.LOGOUT) {
    return {
      ...state,
      user: null,
    };
  }
  return state;
};

// ----------------------------------------------------------------------

const STORAGE_KEY = ACCESS_TOKEN_KEY;

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const syncSessionFromApiResponse = useCallback(
    (payload: TokenPairResponse, rememberMe?: boolean) => {
      const persist = rememberMe ?? getRememberMe();
      if (rememberMe !== undefined) {
        localStorage.setItem(REMEMBER_ME_KEY, String(persist));
      }
      const storage = persist ? localStorage : sessionStorage;
      storage.setItem(REFRESH_TOKEN_KEY, payload.refresh);
      storage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
      setSession(payload.access, persist);
      dispatch({
        type: Types.LOGIN,
        payload: { user: payload.user },
      });
    },
    []
  );

  const initialize = useCallback(async () => {
    try {
      const accessToken = getStoredToken(STORAGE_KEY);
      const refreshToken = getStoredToken(REFRESH_TOKEN_KEY);

      // Access valid → use it. Access expired but refresh present → still try
      // /me; the response interceptor refreshes transparently on 401 so a
      // returning user stays signed in across page reloads.
      const hasUsableSession =
        (accessToken && isValidToken(accessToken)) || Boolean(refreshToken);

      if (!hasUsableSession) {
        dispatch({ type: Types.INITIAL, payload: { user: null } });
        return;
      }

      if (accessToken) {
        setSession(accessToken);
      }

      if (isJwtAuthMock()) {
        const raw = getStoredToken(AUTH_USER_KEY);
        const user = raw ? JSON.parse(raw) : null;
        dispatch({ type: Types.INITIAL, payload: { user } });
        return;
      }

      try {
        const user = await fetchCurrentUser();
        dispatch({ type: Types.INITIAL, payload: { user } });
      } catch {
        // /me failed even after refresh (refresh expired / blacklisted) —
        // the interceptor already cleared storage and triggered a redirect.
        dispatch({ type: Types.INITIAL, payload: { user: null } });
      }
    } catch (error) {
      console.error(error);
      dispatch({ type: Types.INITIAL, payload: { user: null } });
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const login = useCallback(
    async (credentials: LoginRequest, rememberMe?: boolean) => {
      if (isJwtAuthMock()) {
        const accessToken = createMockAccessToken();
        const user = buildMockAuthUser(credentials.username);
        syncSessionFromApiResponse(
          {
            access: accessToken,
            refresh: '',
            user,
          },
          rememberMe
        );
        return;
      }

      const data = await fetchLogin(credentials);
      syncSessionFromApiResponse(data, rememberMe);
    },
    [syncSessionFromApiResponse]
  );

  const logout = useCallback(async () => {
    const refresh = getStoredToken(REFRESH_TOKEN_KEY);
    if (refresh) {
      // Server-side blacklist so the refresh token can't be replayed if it leaks.
      // Best-effort: a failed call (network, already-blacklisted) must not block
      // clearing the local session.
      try {
        await fetchLogout(refresh);
      } catch {
        /* ignore — local session will be cleared regardless */
      }
    }
    setSession(null); // clears all auth keys from both localStorage and sessionStorage
    dispatch({
      type: Types.LOGOUT,
    });
  }, []);

  const checkAuthenticated = state.user ? 'authenticated' : 'unauthenticated';

  const status = state.loading ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    () => ({
      user: state.user,
      method: 'jwt',
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
      syncSessionFromApiResponse,
      login,
      logout,
    }),
    [login, logout, state.user, status, syncSessionFromApiResponse]
  );

  return <AuthContext.Provider value={memoizedValue}>{children}</AuthContext.Provider>;
}
