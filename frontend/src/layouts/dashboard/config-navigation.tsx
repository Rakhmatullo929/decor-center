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
  const { canReadPage, canWritePage, checkPermission } = useCheckPermission();

  return useMemo(() => {
    const groups: NavGroup[] = [];

    const managementItems: NavItem[] = [];
    if (canReadPage('employees') && canWritePage('employees')) {
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

    const surveyItems: NavItem[] = [];
    if (canReadPage('tests')) {
      surveyItems.push({
        title: tx('common.navigation.surveys'),
        path: paths.app.surveys.tests,
        icon: icon('solar:clipboard-list-bold-duotone'),
      });
    }
    if (canReadPage('results')) {
      surveyItems.push({
        title: tx('common.navigation.results'),
        path: paths.app.surveys.results,
        icon: icon('solar:chart-square-bold-duotone'),
      });
    }
    if (surveyItems.length) {
      groups.push({ subheader: tx('common.navigation.surveysGroup'), items: surveyItems });
    }

    if (checkPermission('survey', 'submit')) {
      groups.push({
        subheader: tx('common.navigation.kioskGroup'),
        items: [
          {
            title: tx('common.navigation.kiosk'),
            path: paths.app.kiosk.root,
            icon: icon('solar:posts-carousel-vertical-bold-duotone'),
          },
        ],
      });
    }

    return groups;
  }, [canReadPage, canWritePage, checkPermission, tx]);
}
