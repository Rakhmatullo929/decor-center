import { Helmet } from 'react-helmet-async';

import OtpView from 'src/sections/app/survey-kiosk/otp-view';

export default function ScanOtpPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey Kiosk</title>
      </Helmet>
      <OtpView />
    </>
  );
}
