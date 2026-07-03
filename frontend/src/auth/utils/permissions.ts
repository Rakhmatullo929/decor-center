/**
 * Permission pages mirror `backend/apps/accounts/permission_catalog.py`.
 * Keep both sides in sync when adding a page or action.
 */
export type PermissionPage =
  | 'dashboard'
  | 'employees'
  | 'specialties'
  | 'tests'
  | 'questions'
  | 'results'
  | 'survey';

export type PermissionAction = 'read' | 'detail' | 'write' | 'submit';

export type PermissionKey = `${PermissionPage}:${PermissionAction}`;

function normalizePermissions(permissions: string[] | undefined | null): Set<string> {
  if (!Array.isArray(permissions)) return new Set();
  return new Set(permissions.filter((item) => typeof item === 'string' && item.trim() !== ''));
}

export function buildPermission(page: PermissionPage, action: PermissionAction): PermissionKey {
  return `${page}:${action}`;
}

export function checkPermission(
  permissions: string[] | undefined | null,
  permissionOrPage: PermissionKey | PermissionPage,
  action?: PermissionAction
): boolean {
  const normalized = normalizePermissions(permissions);
  if (normalized.size === 0) return false;

  const key = action
    ? buildPermission(permissionOrPage as PermissionPage, action)
    : (permissionOrPage as PermissionKey);

  return normalized.has(key);
}

export const cp = checkPermission;

export function canReadPage(permissions: string[] | undefined | null, page: PermissionPage): boolean {
  return checkPermission(permissions, page, 'read');
}

export function canWritePage(permissions: string[] | undefined | null, page: PermissionPage): boolean {
  return checkPermission(permissions, page, 'write');
}

export function canDetailPage(permissions: string[] | undefined | null, page: PermissionPage): boolean {
  return checkPermission(permissions, page, 'detail');
}

export function checkAnyPermission(
  permissions: string[] | undefined | null,
  requiredPermissions: Array<PermissionKey>
): boolean {
  const normalized = normalizePermissions(permissions);
  return requiredPermissions.some((permission) => normalized.has(permission));
}

export function checkAllPermissions(
  permissions: string[] | undefined | null,
  requiredPermissions: Array<PermissionKey>
): boolean {
  const normalized = normalizePermissions(permissions);
  return requiredPermissions.every((permission) => normalized.has(permission));
}
