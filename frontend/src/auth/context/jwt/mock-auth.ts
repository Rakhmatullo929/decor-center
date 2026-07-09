import type { DecorUser } from 'src/auth/api/types';

// ----------------------------------------------------------------------

export const isJwtAuthMock = () => process.env.REACT_APP_AUTH_MOCK === 'true';

function encodeBase64Url(obj: object) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** JWT-shaped string so `isValidToken` / `setSession` keep working (signature not verified). */
export function createMockAccessToken(expiresInSec = 60 * 60 * 24 * 365) {
  const header = encodeBase64Url({ alg: 'none', typ: 'JWT' });
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const payload = encodeBase64Url({ exp });
  return `${header}.${payload}.mock`;
}

/** Mirrors `apps.accounts.permission_catalog.ROLE_PERMISSIONS["admin"]`. */
const MOCK_ADMIN_PERMISSIONS = [
  'dashboard:read',
  'employees:read',
  'employees:write',
  'specialties:read',
  'specialties:write',
  'tests:read',
  'tests:write',
  'questions:read',
  'questions:write',
  'results:read',
  'results:detail',
];

export function buildMockAuthUser(username: string): DecorUser {
  return {
    id: 1,
    username: username.trim() || 'admin',
    role: 'admin',
    firstName: 'Mock',
    lastName: 'Admin',
    permissions: MOCK_ADMIN_PERMISSIONS,
    employeeId: null,
    phone: null,
  };
}
