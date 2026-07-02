import { Helmet } from 'react-helmet-async';

import useLocales from 'src/locales/use-locales';
import InstructionsView from 'src/sections/app/instructions/view';

export default function InstructionsPage() {
  const { tx } = useLocales();

  return (
    <>
      <Helmet>
        <title>{`${tx('instructions.title')} | ${tx('common.appName')}`}</title>
      </Helmet>
      <InstructionsView />
    </>
  );
}
