import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import SurveyBlocksView from 'src/sections/app/admin-surveys/builder/blocks-view';

export default function SurveyBlocksPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.builder.blocksTitle')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <SurveyBlocksView />
    </>
  );
}
