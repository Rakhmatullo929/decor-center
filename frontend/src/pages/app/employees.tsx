import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import EmployeesView from 'src/sections/app/employees/view';

export default function EmployeesPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('employees.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <EmployeesView />
    </>
  );
}
