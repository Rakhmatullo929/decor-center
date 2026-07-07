import { useMemo } from 'react';

import { paths } from 'src/routes/paths';
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import { useTestOptionsQuery } from 'src/sections/app/admin-surveys/api/use-surveys-api';
import type { Test } from 'src/sections/app/admin-surveys/api/types';

// ----------------------------------------------------------------------

const icon = (name: string) => <Iconify icon={name} width={24} />;

type NavItem = {
  title: string;
  path: string;
  icon?: React.ReactElement;
};

type NavGroup = {
  subheader: string;
  items: NavItem[];
};

/** Icon reflects how the survey is triggered, so the sidebar reads at a glance
 * instead of every entry looking identical. */
function surveyIconName(test: Test): string {
  if (test.isAdminConducted) return 'solar:user-speak-rounded-bold-duotone'; // 1-on-1 conversation
  if (test.isAfterApplication) return 'solar:user-plus-rounded-bold-duotone'; // one-off after hire
  return 'solar:repeat-bold-duotone'; // periodic (monthly / recurring window)
}

export function useNavData() {
  const { tx } = useLocales();
  const { canReadPage, canWritePage, checkPermission } = useCheckPermission();
  const canReadTests = canReadPage('tests');
  const testOptionsQuery = useTestOptionsQuery({ enabled: canReadTests });
  const testResults = testOptionsQuery.data?.results;
  const tests = useMemo(() => testResults ?? [], [testResults]);

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

    if (canReadTests && tests.length) {
      // No standalone tests-list/management screen — surveys are administered
      // on the backend. Each one links straight into its own block/question
      // builder, flat under the "Опросы" subheader (like every other group).
      groups.push({
        subheader: tx('common.navigation.surveysGroup'),
        items: tests.map((test) => ({
          title: test.title,
          path: paths.app.surveys.blocks(test.id),
          icon: icon(surveyIconName(test)),
        })),
      });
    }

    if (canReadPage('results')) {
      groups.push({
        subheader: tx('common.navigation.resultsGroup'),
        items: [
          {
            title: tx('common.navigation.results'),
            path: paths.app.surveys.results,
            icon: icon('solar:chart-square-bold-duotone'),
          },
        ],
      });
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
  }, [canReadPage, canReadTests, canWritePage, checkPermission, tests, tx]);
}
