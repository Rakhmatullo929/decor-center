import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import MedicalEditView from 'src/sections/app/medical/edit-view';

export default function MedicalEditPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('medical.form.editTitle')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <MedicalEditView />
    </>
  );
}
