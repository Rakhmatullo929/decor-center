import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import QuestionsView from 'src/sections/app/admin-surveys/questions/view';

export default function SurveyQuestionsPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.questions.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <QuestionsView />
    </>
  );
}
