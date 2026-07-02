import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import SpecialtiesView from 'src/sections/app/specialties/view';

export default function SpecialtiesPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('specialties.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <SpecialtiesView />
    </>
  );
}
