// i18n
import 'src/locales/i18n';

// scroll bar
import 'simplebar-react/dist/simplebar.min.css';

// lazy image
import 'react-lazy-load-image-component/src/effects/blur.css';

// ----------------------------------------------------------------------

// @mui
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { QueryClientProvider } from '@tanstack/react-query';
// redux
import ReduxProvider from 'src/redux/redux-provider';
// react-query
import { queryClient } from 'src/lib/react-query';
// routes
import Router from 'src/routes/sections';
// theme
import ThemeProvider from 'src/theme';
// hooks
import { useScrollToTop } from 'src/hooks/use-scroll-to-top';
// components
import ProgressBar from 'src/components/progress-bar';
import MotionLazy from 'src/components/animate/motion-lazy';
import SnackbarProvider from 'src/components/snackbar/snackbar-provider';
import { SettingsProvider, SettingsDrawer } from 'src/components/settings';
// auth
import { AuthProvider, AuthConsumer } from 'src/auth/context/jwt';

// ----------------------------------------------------------------------

export default function App() {
  useScrollToTop();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ReduxProvider>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <SettingsProvider
              defaultSettings={{
                themeMode: 'light',
                themeDirection: 'ltr',
                themeContrast: 'default',
                themeLayout: 'vertical',
                themeColorPresets: 'purple',
                themeStretch: false,
              }}
            >
              <ThemeProvider>
                <MotionLazy>
                  <SnackbarProvider>
                    <SettingsDrawer />
                    <ProgressBar />
                    <AuthConsumer>
                      <Router />
                    </AuthConsumer>
                  </SnackbarProvider>
                </MotionLazy>
              </ThemeProvider>
            </SettingsProvider>
          </LocalizationProvider>
        </ReduxProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
