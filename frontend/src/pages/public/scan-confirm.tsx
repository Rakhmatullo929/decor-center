import { Helmet } from 'react-helmet-async';

import ConfirmView from 'src/sections/app/survey-kiosk/confirm-view';

export default function ScanConfirmPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey Kiosk</title>
      </Helmet>
      <ConfirmView />
    </>
  );
}
