import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { PermissionAction, PermissionPage } from 'src/auth/utils/permissions';
import { paths } from 'src/routes/paths';
import Can from 'src/auth/components/can';

type PermissionGuardProps = {
  page: PermissionPage;
  action: PermissionAction;
  children: ReactNode;
};

export default function PermissionGuard({ page, action, children }: PermissionGuardProps) {
  return (
    <Can page={page} action={action} fallback={<Navigate to={paths.home} replace />}>
      {children}
    </Can>
  );
}
