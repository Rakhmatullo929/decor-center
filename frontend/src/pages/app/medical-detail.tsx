import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import MedicalDetailView from 'src/sections/app/medical/detail-view';

export default function MedicalDetailPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('medical.detail.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <MedicalDetailView />
    </>
  );
}
