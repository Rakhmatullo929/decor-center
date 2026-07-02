import { useMemo } from 'react';

import { useAppUserProfile } from 'src/hooks/use-app-user-profile';

import {
  buildPermission,
  canDetailPage,
  canReadPage,
  canWritePage,
  checkAllPermissions,
  checkAnyPermission,
  checkPermission,
  cp,
  type PermissionAction,
  type PermissionKey,
  type PermissionPage,
} from '../utils/permissions';

export function useCheckPermission() {
  const { user } = useAppUserProfile();
  const { permissions } = user;

  return useMemo(
    () => ({
      permissions,
      buildPermission,
      checkPermission: (permissionOrPage: PermissionKey | PermissionPage, action?: PermissionAction) =>
        checkPermission(permissions, permissionOrPage, action),
      cp: (permissionOrPage: PermissionKey | PermissionPage, action?: PermissionAction) =>
        cp(permissions, permissionOrPage, action),
      canReadPage: (page: PermissionPage) => canReadPage(permissions, page),
      canDetailPage: (page: PermissionPage) => canDetailPage(permissions, page),
      canWritePage: (page: PermissionPage) => canWritePage(permissions, page),
      checkAnyPermission: (requiredPermissions: Array<PermissionKey>) =>
        checkAnyPermission(permissions, requiredPermissions),
      checkAllPermissions: (requiredPermissions: Array<PermissionKey>) =>
        checkAllPermissions(permissions, requiredPermissions),
    }),
    [permissions]
  );
}
