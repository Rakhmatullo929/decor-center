import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
  const firstTestId = testOptions[0]?.id;

  useEffect(() => {
    if (testId === '' && firstTestId !== undefined) {
      setTestId(firstTestId);
    }
  }, [testId, firstTestId]);

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

      <Card sx={{ mb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          sx={{ pr: { sm: 2 } }}
        >
          <Tabs
            value={testId === '' ? false : testId}
            onChange={(_, value) => setTestId(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flexGrow: 1, px: 2 }}
          >
            {testOptions.map((test) => (
              <Tab key={test.id} value={test.id} label={test.title} />
            ))}
          </Tabs>

          <Button
            variant="contained"
            disabled={testId === '' || exportMutation.isPending}
            startIcon={<Iconify icon="solar:export-bold" />}
            onClick={handleExport}
            sx={{ my: { xs: 2, sm: 0 }, mx: { xs: 2, sm: 0 }, flexShrink: 0 }}
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
