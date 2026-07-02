// @mui
import Box, { BoxProps } from '@mui/material/Box';
// hooks
import { useResponsive } from 'src/hooks/use-responsive';
// components
import { useSettingsContext } from 'src/components/settings';
//
import { HEADER, NAV } from '../config-layout';

// ----------------------------------------------------------------------

const SPACING = 8;

type MainProps = BoxProps & { noNav?: boolean };

export default function Main({ children, sx, noNav, ...other }: MainProps) {
  const settings = useSettingsContext();

  const lgUp = useResponsive('up', 'lg');

  const isNavHorizontal = settings.themeLayout === 'horizontal';

  const isNavMini = settings.themeLayout === 'mini';

  if (isNavHorizontal) {
    return (
      <Box
        component="main"
        sx={{
          minHeight: 1,
          display: 'flex',
          flexDirection: 'column',
          px: 2,
          pt: `${HEADER.H_MOBILE + 24}px`,
          pb: 10,
          ...(lgUp && {
            px: 5,
            pt: `${HEADER.H_MOBILE * 2 + 40}px`,
            pb: 15,
          }),
          ...sx,
        }}
        {...other}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        px: 2,
        py: `${HEADER.H_MOBILE + SPACING}px`,
        ...(lgUp && {
          px: 5,
          py: `${HEADER.H_DESKTOP + SPACING}px`,
          ...(!noNav && {
            width: `calc(100% - ${NAV.W_VERTICAL}px)`,
            ...(isNavMini && {
              width: `calc(100% - ${NAV.W_MINI}px)`,
            }),
          }),
        }),
        ...sx,
      }}
      {...other}
    >
      {children}
    </Box>
  );
}
