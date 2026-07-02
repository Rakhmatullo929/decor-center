import { useNavigate } from 'react-router-dom';
// routes
import { paths } from 'src/routes/paths';
//
import type { StartTestSessionResponse } from './api/types';
import { FaceIdStep } from './components';

// ----------------------------------------------------------------------

export default function FaceRecognitionView() {
  const navigate = useNavigate();

  const handleStarted = (data: StartTestSessionResponse) => {
    navigate(paths.app.testing.questions(data.session.employee, data.session.module), {
      state: { session: data.session, questions: data.questions },
    });
  };

  return (
    <FaceIdStep
      onStarted={handleStarted}
      onBack={() => navigate(paths.home)}
    />
  );
}
