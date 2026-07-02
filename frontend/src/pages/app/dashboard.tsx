import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import DashboardView from 'src/sections/app/dashboard/view';

export default function DashboardPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('dashboard.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <DashboardView />
    </>
  );
}
