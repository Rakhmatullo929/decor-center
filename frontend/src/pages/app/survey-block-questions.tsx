import { Helmet } from 'react-helmet-async';
import useLocales from 'src/locales/use-locales';
import SurveyBlockQuestionsView from 'src/sections/app/admin-surveys/builder/block-questions-view';

export default function SurveyBlockQuestionsPage() {
  const { tx } = useLocales();
  return (
    <>
      <Helmet>
        <title>{`${tx('surveys.builder.questionsTitle')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <SurveyBlockQuestionsView />
    </>
  );
}
