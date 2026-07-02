// @mui
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
import { useParams, useRouter } from 'src/routes/hook';
import { paths } from 'src/routes/paths';
// utils
import { fDateTime } from 'src/utils/format-time';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import { LoadingScreen } from 'src/components/loading-screen';
import { useSettingsContext } from 'src/components/settings';
//
import { useEmployeeQuery } from '../employees/api/use-employees-api';
import { useMedicalCheckQuery } from './api/use-medical-api';
import type { MedicalConclusion } from './api/types';

// ----------------------------------------------------------------------

/** "12.0" → "12", "12.5" → "12.5" */
function fmt(value: string) {
  return String(Number(value));
}

type InfoRowProps = { label: string; value: React.ReactNode };

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 200, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------

export default function MedicalDetailView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const router = useRouter();
  const params = useParams();
  const { canWritePage } = useCheckPermission();

  const canWrite = canWritePage('medical');

  const checkQuery = useMedicalCheckQuery(params.id);
  const check = checkQuery.data;
  const isLoading = checkQuery.isPending;

  const employeeQuery = useEmployeeQuery(check?.employee ?? 0);

  if (isLoading) return <LoadingScreen />;

  if (!check) {
    return (
      <EmptyContent
        title={tx('medical.detail.notFound')}
        action={
          <Button onClick={() => router.push(paths.app.medical.root)}>
            {tx('common.actions.back')}
          </Button>
        }
      />
    );
  }

  const conclusionColor: Record<MedicalConclusion, 'success' | 'error'> = {
    approved: 'success',
    rejected: 'error',
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={check.employeeName}
        links={[
          { name: tx('common.appName'), href: paths.home },
          { name: tx('medical.title'), href: paths.app.medical.root },
          { name: check.employeeName },
        ]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:pen-bold" />}
              onClick={() => router.push(paths.app.medical.edit(check.id))}
            >
              {tx('common.actions.edit')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 200, flexShrink: 0 }}>
              {tx('medical.form.employee')}
            </Typography>
            {employeeQuery.isLoading ? (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Skeleton variant="circular" width={40} height={40} />
                <Skeleton variant="text" width={160} height={20} />
              </Stack>
            ) : (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  src={employeeQuery.data?.photo ?? undefined}
                  alt={employeeQuery.data?.fullName}
                  sx={{ width: 40, height: 40, fontWeight: 700 }}
                >
                  {employeeQuery.data?.fullName?.charAt(0).toUpperCase()}
                </Avatar>
                <Stack spacing={0.25}>
                  <Typography variant="subtitle2">
                    {employeeQuery.data?.fullName ?? check.employeeName}
                  </Typography>
                  {employeeQuery.data?.specialtyName && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {employeeQuery.data.specialtyName}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>

          <Divider />

          <InfoRow
            label={tx('medical.table.bp')}
            value={`${check.bpSystolic}/${check.bpDiastolic}`}
          />
          <InfoRow label={tx('medical.table.pulse')} value={check.pulse} />
          <InfoRow label={tx('medical.table.saturation')} value={`${check.saturation}%`} />
          <InfoRow
            label={tx('medical.form.alcoholValue')}
            value={check.alcoholValue !== null ? fmt(check.alcoholValue) : '—'}
          />
          <InfoRow
            label={tx('medical.form.alcoholPositive')}
            value={
              <Label color={check.alcoholPositive ? 'error' : 'success'}>
                {tx(check.alcoholPositive ? 'common.labels.yes' : 'common.labels.no')}
              </Label>
            }
          />
          <InfoRow label={tx('medical.table.hoursWorked')} value={fmt(check.hoursWorked)} />
          <InfoRow label={tx('medical.table.hoursRested')} value={fmt(check.hoursRested)} />

          <Divider />

          <InfoRow
            label={tx('medical.table.conclusion')}
            value={
              <Label color={conclusionColor[check.conclusion]}>
                {tx(`medical.conclusion.${check.conclusion}`)}
              </Label>
            }
          />
          <InfoRow label={tx('medical.form.note')} value={check.note || '—'} />

          <Divider />

          <InfoRow label={tx('medical.table.medic')} value={check.medicUsername} />
          <InfoRow label={tx('medical.table.created')} value={fDateTime(check.createdAt)} />
        </Stack>
      </Card>
    </Container>
  );
}
