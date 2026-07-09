import { Helmet } from 'react-helmet-async';

import ManualPickView from 'src/sections/app/survey-kiosk/manual-pick-view';

export default function ScanManualPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey Kiosk</title>
      </Helmet>
      <ManualPickView />
    </>
  );
}
