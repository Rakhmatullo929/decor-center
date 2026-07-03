import { useMemo, useState } from 'react';
// @mui
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
// framer-motion
import { AnimatePresence, m } from 'framer-motion';
// hooks
import { useDebounce } from 'src/hooks/use-debounce';
import useLocales from 'src/locales/use-locales';
// components
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
//
import type { Employee, EmployeeListParams } from '../../employees/api/types';
import { useKioskEmployeesQuery } from '../api/use-survey-kiosk-api';
import { SurveyEmployeesGridSkeleton } from '../skeleton';

// ----------------------------------------------------------------------

const PAGE_SIZE = 24;

const badgePulse = keyframes`
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
`;

// ----------------------------------------------------------------------

type Props = {
  onSelect: (employee: Employee) => void;
};

function EmployeeRow({
  employee,
  index,
  onSelect,
}: {
  employee: Employee;
  index: number;
  onSelect: (e: Employee) => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;

  const ringPulse = keyframes`
    0%, 100% { box-shadow: 0 0 0 2px ${alpha(primary, 0.35)}; }
    50%       { box-shadow: 0 0 0 6px ${alpha(primary, 0.08)}; }
  `;

  const [hovered, setHovered] = useState(false);

  return (
    <m.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Box
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(employee)}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, md: 2.5 },
          px: { xs: 3, md: 5 },
          py: { xs: 2, md: 2.5 },
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'background-color 0.2s ease',
          bgcolor: hovered ? alpha(primary, isDark ? 0.08 : 0.05) : 'transparent',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '15%',
            bottom: '15%',
            width: 3,
            borderRadius: '0 4px 4px 0',
            bgcolor: primary,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
            boxShadow: hovered ? `0 0 12px ${primary}, 0 0 24px ${alpha(primary, 0.3)}` : 'none',
          },
        }}
      >
        {/* Index */}
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1,
            color: hovered ? alpha(primary, 0.85) : alpha(theme.palette.text.secondary, 0.5),
            width: 28,
            flexShrink: 0,
            letterSpacing: 1.5,
            transition: 'color 0.2s ease',
            userSelect: 'none',
            textAlign: 'right',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </Typography>

        {/* Avatar */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={employee.photo ?? undefined}
            alt={employee.fullName}
            sx={{
              width: 48,
              height: 48,
              fontSize: 18,
              fontWeight: 700,
              bgcolor: alpha(primary, isDark ? 0.15 : 0.1),
              color: primary,
              border: '1.5px solid',
              borderColor: hovered ? alpha(primary, 0.65) : alpha(primary, isDark ? 0.2 : 0.25),
              transition: 'border-color 0.2s ease',
              animation: hovered ? `${ringPulse} 1.8s ease-in-out infinite` : 'none',
            }}
          >
            {employee.fullName.charAt(0).toUpperCase()}
          </Avatar>
          {/* Online dot */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 1,
              right: 1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: theme.palette.success.main,
              border: `2px solid ${isDark ? 'rgba(13,13,24,0.95)' : theme.palette.background.paper}`,
              boxShadow: `0 0 8px ${alpha(theme.palette.success.main, 0.7)}`,
            }}
          />
        </Box>

        {/* Name + specialty */}
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            noWrap
            sx={{
              fontWeight: 600,
              fontSize: { xs: 14, md: 15 },
              lineHeight: 1.3,
              color: hovered ? theme.palette.text.primary : alpha(theme.palette.text.primary, 0.9),
              transition: 'color 0.2s ease',
              letterSpacing: 0.1,
            }}
          >
            {employee.fullName}
          </Typography>
          <Typography
            noWrap
            sx={{
              fontSize: 12,
              lineHeight: 1,
              color: hovered ? alpha(primary, isDark ? 0.85 : 0.75) : theme.palette.text.secondary,
              transition: 'color 0.2s ease',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}
          >
            {employee.specialtyName}
          </Typography>
        </Stack>

        {/* Arrow — always visible, brightens on hover */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            flexShrink: 0,
            bgcolor: hovered ? alpha(primary, 0.18) : alpha(primary, isDark ? 0.06 : 0.06),
            border: '1px solid',
            borderColor: hovered ? alpha(primary, 0.5) : alpha(primary, isDark ? 0.15 : 0.2),
            transition: 'all 0.2s ease',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <Iconify
            icon="eva:arrow-ios-forward-fill"
            sx={{
              color: hovered ? primary : alpha(primary, isDark ? 0.4 : 0.45),
              width: 16,
              transition: 'color 0.2s ease',
            }}
          />
        </Box>
      </Box>
    </m.div>
  );
}

// ----------------------------------------------------------------------

export default function EmployeeStep({ onSelect }: Props) {
  const { tx } = useLocales();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);

  const queryParams = useMemo<EmployeeListParams>(
    () => ({
      isActive: true,
      pageSize: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [debouncedSearch]
  );

  const employeesQuery = useKioskEmployeesQuery(queryParams);
  const employees = employeesQuery.data?.results ?? [];
  const isLoading = employeesQuery.isPending;
  const notFound = !isLoading && employees.length === 0;
  const total = employeesQuery.data?.count ?? 0;

  return (
    <Stack spacing={0}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          px: { xs: 3, md: 5 },
          pt: { xs: 4, md: 5 },
          pb: { xs: 3, md: 4 },
          borderBottom: '1px solid',
          borderColor: alpha(primary, isDark ? 0.12 : 0.15),
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 3, sm: 4 },
        }}
      >
        {/* Title group */}
        <Stack spacing={1.5}>
          {/* Employee badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label="EMPLOYEE ACCESS"
              size="small"
              sx={{
                height: 20,
                fontFamily: 'monospace',
                fontSize: 9,
                letterSpacing: 1.5,
                fontWeight: 700,
                bgcolor: alpha(primary, isDark ? 0.12 : 0.08),
                color: isDark ? alpha(theme.palette.primary.light, 0.9) : theme.palette.primary.dark,
                border: '1px solid',
                borderColor: alpha(primary, isDark ? 0.25 : 0.3),
                borderRadius: 0.75,
                animation: `${badgePulse} 3s ease-in-out infinite`,
                '& .MuiChip-label': { px: 1 },
              }}
            />
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: theme.palette.success.main,
                boxShadow: `0 0 8px ${alpha(theme.palette.success.main, 0.8)}`,
                animation: `${badgePulse} 2s ease-in-out infinite`,
              }}
            />
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: -0.5,
              color: theme.palette.text.primary,
              lineHeight: 1.1,
            }}
          >
            {tx('survey.kiosk.steps.employee')}
          </Typography>

          {!isLoading && total > 0 && (
            <Typography
              sx={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: alpha(theme.palette.text.secondary, 0.7),
                letterSpacing: 2,
                lineHeight: 1,
              }}
            >
              {String(total).padStart(3, '0')} RECORDS FOUND
            </Typography>
          )}
        </Stack>

        {/* Search */}
        <TextField
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={tx('survey.kiosk.employee.searchPlaceholder')}
          size="small"
          sx={{
            width: { xs: '100%', sm: 280 },
            '& .MuiOutlinedInput-root': {
              fontFamily: 'monospace',
              fontSize: 13,
              height: 42,
              borderRadius: 1.5,
              bgcolor: alpha(primary, isDark ? 0.04 : 0.04),
              color: theme.palette.text.primary,
              '& fieldset': { borderColor: alpha(primary, isDark ? 0.18 : 0.2) },
              '&:hover fieldset': { borderColor: alpha(primary, isDark ? 0.35 : 0.4) },
              '&.Mui-focused fieldset': {
                borderColor: alpha(primary, 0.6),
                boxShadow: `0 0 0 3px ${alpha(primary, 0.1)}`,
              },
            },
            '& .MuiOutlinedInput-input': {
              color: theme.palette.text.primary,
              '&::placeholder': { color: alpha(theme.palette.text.secondary, 0.6), opacity: 1 },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: alpha(primary, 0.5), width: 16 }} />
              </InputAdornment>
            ),
            endAdornment: !searchInput ? (
              <InputAdornment position="end">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 0.75,
                    py: 0.3,
                    borderRadius: 0.75,
                    bgcolor: alpha(theme.palette.text.primary, isDark ? 0.05 : 0.04),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.text.secondary, isDark ? 0.15 : 0.2),
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: alpha(theme.palette.text.secondary, 0.7),
                      lineHeight: 1,
                      fontFamily: 'monospace',
                    }}
                  >
                    ⌘K
                  </Typography>
                </Box>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <Box sx={{ pt: 1.5, pb: { xs: 3, md: 4 } }}>

        {isLoading && (
          <Box sx={{ px: { xs: 3, md: 5 }, py: 1 }}>
            <SurveyEmployeesGridSkeleton items={5} />
          </Box>
        )}

        {!isLoading && notFound && (
          <EmptyContent filled title={tx('survey.kiosk.employee.empty')} sx={{ py: 10 }} />
        )}

        {!isLoading && !notFound && (
          <AnimatePresence mode="popLayout">
            {employees.map((employee, i) => (
              <Box key={employee.id}>
                <EmployeeRow employee={employee} index={i} onSelect={onSelect} />
                {i < employees.length - 1 && (
                  <Box
                    sx={{
                      mx: { xs: 3, md: 5 },
                      height: '1px',
                      background: `linear-gradient(to right, transparent, ${alpha(primary, isDark ? 0.1 : 0.12)} 20%, ${alpha(primary, isDark ? 0.1 : 0.12)} 80%, transparent)`,
                    }}
                  />
                )}
              </Box>
            ))}
          </AnimatePresence>
        )}
      </Box>
    </Stack>
  );
}
