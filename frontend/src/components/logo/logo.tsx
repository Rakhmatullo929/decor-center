import { forwardRef } from 'react';
// @mui
import { useTheme } from '@mui/material/styles';
import Link from '@mui/material/Link';
import Box, { BoxProps } from '@mui/material/Box';
// routes
import { RouterLink } from 'src/routes/components';

// ----------------------------------------------------------------------

export interface LogoProps extends BoxProps {
  disabledLink?: boolean;
}

const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ disabledLink = false, sx, ...other }, ref) => {
    const theme = useTheme();
    const logoColor = theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark;

    // OR using local (public folder)
    // -------------------------------------------------------
    // const logo = (
    //   <Box
    //     component="img"
    //     src="/logo/logo_single.svg" => your path
    //     sx={{ width: 40, height: 40, cursor: 'pointer', ...sx }}
    //   />
    // );

    const logo = (
      <Box
        ref={ref}
        component="div"
        sx={{
          width: 40,
          height: 40,
          display: 'inline-flex',
          ...sx,
        }}
        {...other}
      >
        <Box
          component="svg"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          width="100%"
          height="100%"
          sx={{ color: logoColor }}
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Locomotive body */}
            <path d="M12 8h16a8 8 0 0 1 8 8v18a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
            {/* Windshield */}
            <path d="M14 14h12v8H14z" fill="currentColor" stroke="none" />
            {/* Headlight */}
            <circle cx="29" cy="30" r="2.5" fill="currentColor" stroke="none" />
            {/* Wheels */}
            <circle cx="16" cy="42" r="3.5" />
            <circle cx="30" cy="42" r="3.5" />
            {/* Rail */}
            <path d="M4 38h6M38 38h6" />
          </g>
        </Box>
      </Box>
    );

    if (disabledLink) {
      return logo;
    }

    return (
      <Link component={RouterLink} href="/" sx={{ display: 'contents' }}>
        {logo}
      </Link>
    );
  }
);

export default Logo;
