import type { ReactNode } from 'react';

import { useCheckPermission } from 'src/auth/hooks/use-check-permission';
import type { PermissionAction, PermissionPage } from 'src/auth/utils/permissions';

type CanProps = {
  page: PermissionPage;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function Can({ page, action, children, fallback = null }: CanProps) {
  const { cp } = useCheckPermission();
  return cp(page, action) ? <>{children}</> : <>{fallback}</>;
}
