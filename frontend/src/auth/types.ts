import type { DepoUser, LoginRequest, TokenPairResponse } from './api/types';

// ----------------------------------------------------------------------

export type ActionMapType<M extends { [index: string]: any }> = {
  [Key in keyof M]: M[Key] extends undefined
    ? {
        type: Key;
      }
    : {
        type: Key;
        payload: M[Key];
      };
};

export type AuthUserType = DepoUser | Record<string, unknown> | null;

export type AuthStateType = {
  status?: string;
  loading: boolean;
  user: AuthUserType;
};

export type JWTContextType = {
  user: AuthUserType;
  method: string;
  loading: boolean;
  authenticated: boolean;
  unauthenticated: boolean;
  /** Apply Django `{ access, refresh, user }` and sync React state + storage. */
  syncSessionFromApiResponse: (payload: TokenPairResponse, rememberMe?: boolean) => void;
  login: (credentials: LoginRequest, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};
