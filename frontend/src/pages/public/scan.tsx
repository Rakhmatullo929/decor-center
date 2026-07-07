import { Helmet } from 'react-helmet-async';

import ScanView from 'src/sections/app/survey-kiosk/scan-view';

export default function ScanPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey Kiosk</title>
      </Helmet>
      <ScanView />
    </>
  );
}
