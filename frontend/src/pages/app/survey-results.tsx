import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import SurveyResultsView from 'src/sections/app/admin-surveys/results/view';

export default function SurveyResultsPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.results.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <SurveyResultsView />
    </>
  );
}
