import { useState } from 'react';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import useLocales from 'src/locales/use-locales';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { TableHeadCustom, TableNoData, TablePaginationCustom, useTable } from 'src/components/table';
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hook';
import { fDateTime } from 'src/utils/format-time';
import { useSurveySessionsQuery, useTestOptionsQuery } from '../api/use-surveys-api';
import type { SurveySessionStatus } from '../api/types';

const STATUS_COLOR: Record<SurveySessionStatus, 'info' | 'success' | 'warning'> = {
  in_progress: 'info',
  completed: 'success',
  abandoned: 'warning',
};

export default function SurveySessionsView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const router = useRouter();
  const table = useTable({ defaultRowsPerPage: 25 });

  const [testId, setTestId] = useState<number | ''>('');
  const testOptionsQuery = useTestOptionsQuery();
  const testOptions = testOptionsQuery.data?.results ?? [];

  // No test picked => every session across every survey; picking one filters server-side.
  const sessionsQuery = useSurveySessionsQuery(testId === '' ? {} : { test: testId });
  const sessions = sessionsQuery.data ?? [];
  const pageRows = sessions.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const statusLabel = (status: SurveySessionStatus) => tx(`surveys.sessions.status.${status}`);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.sessions.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('surveys.sessions.title') }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 2.5, mb: 3 }}>
        <TextField
          select
          label={tx('surveys.sessions.selectTest')}
          value={testId}
          onChange={(e) => {
            setTestId(e.target.value === '' ? '' : Number(e.target.value));
            table.onChangePage(null, 0);
          }}
          sx={{ minWidth: 280 }}
        >
          <MenuItem value="">{tx('surveys.sessions.allTests')}</MenuItem>
          {testOptions.map((test) => (
            <MenuItem key={test.id} value={test.id}>
              {test.title}
            </MenuItem>
          ))}
        </TextField>
      </Card>

      <Card>
        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium" sx={{ minWidth: 720 }}>
              <TableHeadCustom
                headLabel={[
                  { id: 'employee', label: tx('surveys.sessions.table.employee') },
                  { id: 'test', label: tx('surveys.sessions.table.test') },
                  { id: 'status', label: tx('surveys.sessions.table.status') },
                  { id: 'startedAt', label: tx('surveys.sessions.table.startedAt') },
                  { id: 'completedAt', label: tx('surveys.sessions.table.completedAt') },
                ]}
              />
              <TableBody>
                {pageRows.map((session) => (
                  <TableRow
                    key={session.id}
                    hover
                    onClick={() => router.push(paths.app.surveys.session(session.id))}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{session.employeeName}</TableCell>
                    <TableCell>{session.testTitle}</TableCell>
                    <TableCell>
                      <Label color={STATUS_COLOR[session.status]}>
                        {statusLabel(session.status)}
                      </Label>
                    </TableCell>
                    <TableCell>{fDateTime(session.startedAt)}</TableCell>
                    <TableCell>
                      {session.completedAt ? fDateTime(session.completedAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                <TableNoData
                  notFound={!sessionsQuery.isPending && sessions.length === 0}
                  title={tx('surveys.sessions.empty')}
                />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={sessions.length}
          page={table.page}
          rowsPerPage={table.rowsPerPage}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
        />
      </Card>
    </Container>
  );
}
