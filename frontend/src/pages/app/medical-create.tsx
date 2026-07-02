import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import MedicalCreateView from 'src/sections/app/medical/create-view';

export default function MedicalCreatePage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('medical.form.createTitle')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <MedicalCreateView />
    </>
  );
}
