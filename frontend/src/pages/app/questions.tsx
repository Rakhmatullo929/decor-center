import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import QuestionsView from 'src/sections/app/questions/view';

export default function QuestionsPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('questions.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <QuestionsView />
    </>
  );
}
