import type { PropsWithChildren } from 'react';
// @mui
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { useSettingsContext } from 'src/components/settings';
// routes
import { paths } from 'src/routes/paths';
//
import ThreeBg from './three-bg';

// ----------------------------------------------------------------------

const cornerGlow = keyframes`
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
`;

// ----------------------------------------------------------------------

export default function SurveyPanel({ children }: PropsWithChildren) {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  const threeColor = parseInt(primary.replace('#', ''), 16);

  const gridBg = `
    linear-gradient(${alpha(primary, 0.04)} 1px, transparent 1px),
    linear-gradient(90deg, ${alpha(primary, 0.04)} 1px, transparent 1px)
  `;

  return (
    <Box sx={{ position: 'relative' }}>
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading={tx('survey.kiosk.title')}
          links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('survey.kiosk.title') }]}
          sx={{ mb: { xs: 4, md: 6 } }}
        />

        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: alpha(primary, isDark ? 0.18 : 0.15),
            bgcolor: isDark
              ? alpha(theme.palette.background.default, 0.92)
              : alpha(theme.palette.background.paper, 0.92),
            backdropFilter: 'blur(20px)',
            boxShadow: isDark
              ? `0 0 0 1px ${alpha(primary, 0.08)} inset, 0 24px 64px ${alpha('#000', 0.5)}, 0 0 80px ${alpha(primary, 0.06)}`
              : `0 0 0 1px ${alpha(primary, 0.06)} inset, 0 24px 64px ${alpha('#000', 0.1)}, 0 0 80px ${alpha(primary, 0.04)}`,
            backgroundImage: gridBg,
            backgroundSize: '40px 40px',
          }}
        >
          <ThreeBg color={threeColor} particleCount={70} />

          {(['top left', 'top right', 'bottom left', 'bottom right'] as const).map((pos) => {
            const isTop = pos.includes('top');
            const isLeft = pos.includes('left');
            return (
              <Box
                key={pos}
                sx={{
                  position: 'absolute',
                  top: isTop ? 0 : 'auto',
                  bottom: isTop ? 'auto' : 0,
                  left: isLeft ? 0 : 'auto',
                  right: isLeft ? 'auto' : 0,
                  width: 120,
                  height: 120,
                  background: `radial-gradient(circle at ${isLeft ? '0%' : '100%'} ${isTop ? '0%' : '100%'}, ${alpha(primary, isDark ? 0.12 : 0.08)} 0%, transparent 70%)`,
                  pointerEvents: 'none',
                  zIndex: 0,
                  animation: `${cornerGlow} 4s ease-in-out infinite`,
                  animationDelay: `${pos.split(' ').length * 0.8}s`,
                }}
              />
            );
          })}

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {children}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
