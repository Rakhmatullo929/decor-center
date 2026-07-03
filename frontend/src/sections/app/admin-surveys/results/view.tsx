import { useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'src/components/snackbar';
import useLocales from 'src/locales/use-locales';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { downloadBlob } from 'src/utils/download-file';
import { paths } from 'src/routes/paths';
import {
  useExportSurveyResultsMutation,
  useSurveyResultsQuery,
  useTestOptionsQuery,
} from '../api/use-surveys-api';
import QuestionResultCard from './components/question-result-card';

export default function SurveyResultsView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [testId, setTestId] = useState<number | ''>('');
  const testOptionsQuery = useTestOptionsQuery();
  const testOptions = testOptionsQuery.data?.results ?? [];

  const resultsQuery = useSurveyResultsQuery(testId === '' ? null : { test: testId });
  const results = resultsQuery.data;

  const exportMutation = useExportSurveyResultsMutation();

  const handleExport = () => {
    if (testId === '') return;
    exportMutation.mutate(
      { test: testId },
      {
        onSuccess: (blob) => {
          downloadBlob(blob, `survey-results-${testId}.xlsx`);
          enqueueSnackbar(tx('surveys.results.toasts.exported'));
        },
      }
    );
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.results.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('surveys.results.title') }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            select
            label={tx('surveys.results.selectTest')}
            value={testId}
            onChange={(e) => setTestId(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{ minWidth: 280 }}
          >
            {testOptions.map((test) => (
              <MenuItem key={test.id} value={test.id}>
                {test.title}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="contained"
            disabled={testId === '' || exportMutation.isPending}
            startIcon={<Iconify icon="solar:export-bold" />}
            onClick={handleExport}
            sx={{ ml: { sm: 'auto' } }}
          >
            {tx('common.actions.export')}
          </Button>
        </Stack>
      </Card>

      {testId === '' && (
        <EmptyContent filled title={tx('surveys.results.pickTestPrompt')} sx={{ py: 10 }} />
      )}

      {results && (
        <Stack spacing={4}>
          {results.blocks.map((block) => (
            <Stack key={block.id} spacing={3}>
              {block.title && (
                <Typography variant="h6">{block.title}</Typography>
              )}
              {block.questions.map((question) => (
                <QuestionResultCard key={question.id} result={question} />
              ))}
            </Stack>
          ))}
        </Stack>
      )}
    </Container>
  );
}
