import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import FaceRecognitionView from 'src/sections/app/testing/face-recognition-view';

export default function TestingPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('testing.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <FaceRecognitionView />
    </>
  );
}
