import { Helmet } from 'react-helmet-async';

import KioskAnswerView from 'src/sections/app/survey-kiosk/answer-view';

export default function ScanAnswerPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey</title>
      </Helmet>
      <KioskAnswerView />
    </>
  );
}
