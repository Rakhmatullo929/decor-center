import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import MedicalView from 'src/sections/app/medical/view';

export default function MedicalPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('medical.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <MedicalView />
    </>
  );
}
