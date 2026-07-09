import { Helmet } from 'react-helmet-async';

import DueSurveysView from 'src/sections/app/survey-kiosk/due-surveys-view';

export default function EmployeeCabinetPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Employee Cabinet</title>
      </Helmet>
      <DueSurveysView />
    </>
  );
}
