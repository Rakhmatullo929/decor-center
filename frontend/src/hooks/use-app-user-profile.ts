import type { DecorUser, UserRole } from 'src/auth/api/types';
import type { AuthUserType } from 'src/auth/types';
import { useAuthContext } from 'src/auth/hooks/use-auth-context';

/**
 * Minimals dashboard expects displayName, role, etc.
 * This maps the JWT `DecorUser` into that profile shape.
 */
export type AppUserProfile = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole | '';
  permissions: string[];
  photoURL?: string;
};

function isDecorUser(u: unknown): u is DecorUser {
  return (
    u !== null &&
    typeof u === 'object' &&
    typeof (u as DecorUser).id === 'number' &&
    typeof (u as DecorUser).username === 'string' &&
    typeof (u as DecorUser).role === 'string'
  );
}

function emptyProfile(partial: Partial<AppUserProfile> = {}): AppUserProfile {
  return {
    id: 0,
    username: '',
    displayName: '',
    role: '',
    permissions: [],
    photoURL: undefined,
    ...partial,
  };
}

function mapAuthUserToProfile(u: NonNullable<AuthUserType>): AppUserProfile {
  if (isDecorUser(u)) {
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return emptyProfile({
      id: u.id,
      username: u.username,
      displayName: fullName || u.username,
      role: u.role,
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
    });
  }

  const rec = u as Record<string, unknown>;
  const username = typeof rec.username === 'string' ? rec.username : '';
  const displayName = typeof rec.displayName === 'string' ? rec.displayName : username;
  const permissions = Array.isArray(rec.permissions)
    ? rec.permissions.filter((item): item is string => typeof item === 'string')
    : [];
  const role = rec.role === 'admin' || rec.role === 'employee' ? rec.role : '';

  return emptyProfile({
    id: typeof rec.id === 'number' ? rec.id : 0,
    username,
    displayName,
    role,
    permissions,
    photoURL: typeof rec.photoURL === 'string' ? rec.photoURL : undefined,
  });
}

// ----------------------------------------------------------------------

export function useAppUserProfile() {
  const { user } = useAuthContext();

  if (!user) {
    return { user: emptyProfile() };
  }

  return { user: mapAuthUserToProfile(user) };
}
