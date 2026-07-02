import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import ResultsView from 'src/sections/app/results/view';

export default function ResultsPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('results.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <ResultsView />
    </>
  );
}
