import { Helmet } from 'react-helmet-async';

import DueSurveysView from 'src/sections/app/survey-kiosk/due-surveys-view';

export default function ScanDuePage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey Kiosk</title>
      </Helmet>
      <DueSurveysView />
    </>
  );
}
