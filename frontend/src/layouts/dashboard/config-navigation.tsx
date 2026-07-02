import { useMemo } from 'react';

import { paths } from 'src/routes/paths';
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

const icon = (name: string) => <Iconify icon={name} width={24} />;

type NavItem = {
  title: string;
  path: string;
  icon: React.ReactElement;
};

type NavGroup = {
  subheader: string;
  items: NavItem[];
};

export function useNavData() {
  const { tx } = useLocales();
  const { canReadPage, canWritePage } = useCheckPermission();

  return useMemo(() => {
    const groups: NavGroup[] = [];

    const managementItems: NavItem[] = [];
    if (canReadPage('dashboard')) {
      managementItems.push({
        title: tx('common.navigation.dashboard'),
        path: paths.app.dashboard,
        icon: icon('solar:chart-2-bold-duotone'),
      });
    }
    if (canReadPage('employees') && canWritePage('employees')) {
      // Read-only employees access (specialist/medic) is used inside their own
      // flows; the directory menu item is shown to managers only.
      managementItems.push({
        title: tx('common.navigation.employees'),
        path: paths.app.employees,
        icon: icon('solar:users-group-rounded-bold-duotone'),
      });
    }
    if (canReadPage('specialties')) {
      managementItems.push({
        title: tx('common.navigation.specialties'),
        path: paths.app.specialties,
        icon: icon('solar:case-minimalistic-bold-duotone'),
      });
    }
    if (managementItems.length) {
      groups.push({ subheader: tx('common.navigation.management'), items: managementItems });
    }

    const assessmentItems: NavItem[] = [];
    if (canWritePage('testing')) {
      assessmentItems.push({
        title: tx('common.navigation.testing'),
        path: paths.app.testing.root,
        icon: icon('solar:clipboard-check-bold-duotone'),
      });
    }
    if (canReadPage('questions')) {
      assessmentItems.push({
        title: tx('common.navigation.questions'),
        path: paths.app.questions,
        icon: icon('solar:question-circle-bold-duotone'),
      });
    }
    if (canReadPage('instructions')) {
      assessmentItems.push({
        title: tx('common.navigation.instructions'),
        path: paths.app.instructions,
        icon: icon('solar:document-text-bold-duotone'),
      });
    }
    if (canReadPage('results')) {
      assessmentItems.push({
        title: tx('common.navigation.results'),
        path: paths.app.results.root,
        icon: icon('solar:chart-square-bold-duotone'),
      });
    }
    if (assessmentItems.length) {
      groups.push({ subheader: tx('common.navigation.assessments'), items: assessmentItems });
    }

    if (canReadPage('medical')) {
      groups.push({
        subheader: tx('common.navigation.medicalGroup'),
        items: [
          {
            title: tx('common.navigation.medical'),
            path: paths.app.medical.root,
            icon: icon('solar:heart-pulse-bold-duotone'),
          },
        ],
      });
    }

    return groups;
  }, [canReadPage, canWritePage, tx]);
}
