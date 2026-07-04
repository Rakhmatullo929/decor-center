import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import SurveyBuilderView from 'src/sections/app/admin-surveys/builder/view';

export default function SurveyBlocksPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.builder.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <SurveyBuilderView />
    </>
  );
}
