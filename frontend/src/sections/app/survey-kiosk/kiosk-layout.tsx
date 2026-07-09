import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LoadingScreen } from 'src/components/loading-screen';
import { KioskSessionProvider } from './session/kiosk-session-context';

/** Wraps every /scan/* step in one shared, refresh-surviving session and one Suspense boundary. */
export default function KioskLayout() {
  return (
    <KioskSessionProvider>
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </KioskSessionProvider>
  );
}
