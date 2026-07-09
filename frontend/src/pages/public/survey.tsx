import { Helmet } from 'react-helmet-async';

import SurveyFormView from 'src/sections/app/survey-kiosk/survey-form-view';

export default function SurveyPage() {
  return (
    <>
      <Helmet>
        <title>Decor Center — Survey</title>
      </Helmet>
      <SurveyFormView />
    </>
  );
}
