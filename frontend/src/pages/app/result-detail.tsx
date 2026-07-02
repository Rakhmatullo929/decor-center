import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import ResultDetailView from 'src/sections/app/results/details/view';

export default function ResultDetailPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('results.detailTitle')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <ResultDetailView />
    </>
  );
}
