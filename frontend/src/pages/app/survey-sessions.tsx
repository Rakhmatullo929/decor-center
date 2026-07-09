import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import SurveySessionsView from 'src/sections/app/admin-surveys/sessions/view';

export default function SurveySessionsPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.sessions.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <SurveySessionsView />
    </>
  );
}
