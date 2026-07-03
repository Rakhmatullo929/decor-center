import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import BlocksView from 'src/sections/app/admin-surveys/blocks/view';

export default function SurveyBlocksPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.blocks.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <BlocksView />
    </>
  );
}
