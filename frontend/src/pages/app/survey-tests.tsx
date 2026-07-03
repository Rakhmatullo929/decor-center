import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import TestsView from 'src/sections/app/admin-surveys/tests/view';

export default function SurveyTestsPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.tests.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <TestsView />
    </>
  );
}
