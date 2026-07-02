/** Matches `accounts.Roles` on the backend. */
export type UserRole = 'admin' | 'specialist' | 'medic';

/** Matches DRF `MeSerializer` response after `humps.camelizeKeys`. */
export type DepoUser = {
  id: number;
  username: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  /** `"<page>:<action>"` keys derived from the role server-side. */
  permissions: string[];
};

/** Login response from `DepoTokenObtainPairSerializer`. */
export type TokenPairResponse = {
  access: string;
  refresh: string;
  user: DepoUser;
};

export type LoginRequest = {
  username: string;
  password: string;
};
