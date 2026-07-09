import { Helmet } from 'react-helmet-async';

import FaceIdView from 'src/sections/app/survey-kiosk/face-id-view';

export default function ScanPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey Kiosk</title>
      </Helmet>
      <FaceIdView />
    </>
  );
}
