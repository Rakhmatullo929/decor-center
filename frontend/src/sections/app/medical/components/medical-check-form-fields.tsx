import { useFormContext } from 'react-hook-form';
// @mui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import { RHFRadioGroup, RHFSwitch, RHFTextField } from 'src/components/hook-form';
//
import type { MedicalCheckFieldsValues } from './utils/medical-check-schema';

// ----------------------------------------------------------------------

/**
 * Vital-sign + conclusion fields shared by the create and edit pages.
 * Must be rendered inside a <FormProvider> with MedicalCheckFieldsValues.
 */
export default function MedicalCheckFormFields() {
  const { tx } = useLocales();
  const { watch } = useFormContext<MedicalCheckFieldsValues>();

  const [bpSystolic, bpDiastolic, pulse, saturation, alcoholPositive] = watch([
    'bpSystolic',
    'bpDiastolic',
    'pulse',
    'saturation',
    'alcoholPositive',
  ]);

  // SRS §7.5: non-blocking visual warning — the medic still decides.
  const showRiskWarning =
    alcoholPositive ||
    (saturation > 0 && saturation < 92) ||
    (pulse > 0 && (pulse < 50 || pulse > 110)) ||
    bpSystolic > 140 ||
    bpDiastolic > 90;

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        <RHFTextField
          name="bpSystolic"
          type="number"
          label={`${tx('medical.form.bpSystolic')} *`}
          inputProps={{ min: 40, max: 300, step: 1 }}
        />
        <RHFTextField
          name="bpDiastolic"
          type="number"
          label={`${tx('medical.form.bpDiastolic')} *`}
          inputProps={{ min: 20, max: 200, step: 1 }}
        />
        <RHFTextField
          name="pulse"
          type="number"
          label={`${tx('medical.form.pulse')} *`}
          inputProps={{ min: 20, max: 250, step: 1 }}
        />
        <RHFTextField
          name="saturation"
          type="number"
          label={`${tx('medical.form.saturation')} *`}
          inputProps={{ min: 50, max: 100, step: 1 }}
        />
        <RHFTextField
          name="hoursWorked"
          type="number"
          label={`${tx('medical.form.hoursWorked')} *`}
          inputProps={{ min: 0, max: 24, step: 0.5 }}
        />
        <RHFTextField
          name="hoursRested"
          type="number"
          label={`${tx('medical.form.hoursRested')} *`}
          inputProps={{ min: 0, max: 168, step: 0.5 }}
        />
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <RHFTextField
          name="alcoholValue"
          type="number"
          label={tx('medical.form.alcoholValue')}
          inputProps={{ min: 0, max: 99.999, step: 0.001 }}
          sx={{ flex: 1 }}
        />
        <RHFSwitch name="alcoholPositive" label={tx('medical.form.alcoholPositive')} />
      </Stack>

      {showRiskWarning && (
        <Alert severity="warning">{tx('medical.warnings.outOfRange')}</Alert>
      )}

      <RHFRadioGroup
        row
        name="conclusion"
        label={tx('medical.form.conclusion')}
        options={[
          { value: 'approved', label: tx('medical.conclusion.approved') },
          { value: 'rejected', label: tx('medical.conclusion.rejected') },
        ]}
      />

      <RHFTextField name="note" label={tx('medical.form.note')} multiline rows={3} />
    </Stack>
  );
}
