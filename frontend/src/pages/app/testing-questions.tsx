import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import QuestionsView from 'src/sections/app/testing/questions-view';

export default function TestingQuestionsPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('testing.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <QuestionsView />
    </>
  );
}
