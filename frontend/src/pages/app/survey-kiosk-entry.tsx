import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import KioskEntryView from 'src/sections/app/survey-kiosk/entry-view';

export default function SurveyKioskEntryPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('survey.kiosk.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <KioskEntryView />
    </>
  );
}
