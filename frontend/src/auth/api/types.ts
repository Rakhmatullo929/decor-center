/** Matches `accounts.Roles` on the backend. */
export type UserRole = 'admin' | 'employee';

/** Matches DRF `MeSerializer` response after `humps.camelizeKeys`. */
export type DecorUser = {
  id: number;
  username: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  /** `"<page>:<action>"` keys derived from the role server-side. */
  permissions: string[];
};

/** Login response from `DecorTokenObtainPairSerializer`. */
export type TokenPairResponse = {
  access: string;
  refresh: string;
  user: DecorUser;
};

export type LoginRequest = {
  username: string;
  password: string;
};
