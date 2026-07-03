import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import KioskAnswerView from 'src/sections/app/survey-kiosk/answer-view';

export default function SurveyKioskAnswerPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('survey.kiosk.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <KioskAnswerView />
    </>
  );
}
