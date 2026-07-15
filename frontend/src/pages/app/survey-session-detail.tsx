import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import SurveySessionDetailView from 'src/sections/app/admin-surveys/sessions/detail-view';

export default function SurveySessionDetailPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.sessions.detail.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <SurveySessionDetailView />
    </>
  );
}
