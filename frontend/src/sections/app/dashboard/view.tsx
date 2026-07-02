import { useMemo } from 'react';
// @mui
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Unstable_Grid2';
// hooks
import { stringParam, useUrlQueryState } from 'src/hooks/use-url-query-state';
import useLocales from 'src/locales/use-locales';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import { paths } from 'src/routes/paths';
//
import { MODULE_LABEL_KEYS } from '../results/components/utils/module-label';
import { useDashboardStatsQuery } from './api/use-dashboard-api';
import type { DashboardStatsParams } from './api/types';
import { StatCard } from './components';
import { DashboardSkeleton } from './skeleton';

// ----------------------------------------------------------------------

/** The selected day lives in the URL so the dashboard can be shared/bookmarked. */
const FILTERS_SCHEMA = {
  date: stringParam(''),
};

export default function DashboardView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();

  const filters = useUrlQueryState(FILTERS_SCHEMA);

  const params = useMemo<DashboardStatsParams>(
    () => (filters.values.date ? { date: filters.values.date } : {}),
    [filters.values.date]
  );

  const statsQuery = useDashboardStatsQuery(params);
  const stats = statsQuery.data;
  const isLoading = statsQuery.isPending;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('dashboard.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('dashboard.title') }]}
        action={
          <TextField
            type="date"
            size="small"
            label={tx('dashboard.dateLabel')}
            value={filters.values.date || stats?.date || ''}
            onChange={(event) => filters.setValues({ date: event.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {isLoading && <DashboardSkeleton />}

      {!isLoading && !stats && <EmptyContent filled title={tx('common.table.noData')} />}

      {!isLoading && stats && (
        <Stack spacing={4}>
          <Stack spacing={2}>
            <Typography variant="h6">{tx('dashboard.tests.title')}</Typography>
            <Grid container spacing={3}>
              <Grid xs={12} sm={6} md={3}>
                <StatCard
                  title={tx('dashboard.tests.total')}
                  value={stats.tests.total}
                  icon="solar:clipboard-check-bold-duotone"
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <StatCard
                  title={tx('dashboard.tests.passed')}
                  value={stats.tests.passed}
                  icon="solar:check-circle-bold-duotone"
                  color="success"
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <StatCard
                  title={tx('dashboard.tests.failed')}
                  value={stats.tests.failed}
                  icon="solar:close-circle-bold-duotone"
                  color="error"
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <StatCard
                  title={tx('dashboard.tests.inProgress')}
                  value={stats.tests.inProgress}
                  icon="solar:hourglass-bold-duotone"
                  color="warning"
                />
              </Grid>
            </Grid>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h6">{tx('dashboard.medical.title')}</Typography>
            <Grid container spacing={3}>
              <Grid xs={12} sm={6} md={3}>
                <StatCard
                  title={tx('dashboard.medical.total')}
                  value={stats.medical.total}
                  icon="solar:heart-pulse-bold-duotone"
                  color="info"
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <StatCard
                  title={tx('dashboard.medical.approved')}
                  value={stats.medical.approved}
                  icon="solar:like-bold-duotone"
                  color="success"
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <StatCard
                  title={tx('dashboard.medical.rejected')}
                  value={stats.medical.rejected}
                  icon="solar:dislike-bold-duotone"
                  color="error"
                />
              </Grid>
            </Grid>
          </Stack>

          <Grid container spacing={3}>
            <Grid xs={12} md={5}>
              <Card>
                <CardHeader title={tx('dashboard.byModule.title')} />
                <Stack spacing={2} sx={{ p: 3 }}>
                  {stats.tests.byModule.length === 0 && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {tx('dashboard.byModule.empty')}
                    </Typography>
                  )}
                  {stats.tests.byModule.map((row) => (
                    <Stack
                      key={row.module}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="body2">{tx(MODULE_LABEL_KEYS[row.module])}</Typography>
                      <Typography variant="subtitle2">
                        {tx('dashboard.byModule.passedOf', {
                          passed: row.passed,
                          total: row.total,
                        })}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            </Grid>

            <Grid xs={12} md={7}>
              <Stack spacing={2}>
                <Typography variant="h6">{tx('dashboard.totals.title')}</Typography>
                <Grid container spacing={3}>
                  <Grid xs={12} sm={6}>
                    <StatCard
                      title={tx('dashboard.totals.activeEmployees')}
                      value={stats.totals.activeEmployees}
                      icon="solar:users-group-rounded-bold-duotone"
                    />
                  </Grid>
                  <Grid xs={12} sm={6}>
                    <StatCard
                      title={tx('dashboard.totals.approvedQuestions')}
                      value={stats.totals.approvedQuestions}
                      icon="solar:question-circle-bold-duotone"
                      color="success"
                    />
                  </Grid>
                  <Grid xs={12} sm={6}>
                    <StatCard
                      title={tx('dashboard.totals.draftQuestions')}
                      value={stats.totals.draftQuestions}
                      icon="solar:question-circle-bold-duotone"
                      color="warning"
                    />
                  </Grid>
                  <Grid xs={12} sm={6}>
                    <StatCard
                      title={tx('dashboard.totals.instructions')}
                      value={stats.totals.instructions}
                      icon="solar:document-text-bold-duotone"
                      color="info"
                    />
                  </Grid>
                </Grid>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      )}
    </Container>
  );
}
