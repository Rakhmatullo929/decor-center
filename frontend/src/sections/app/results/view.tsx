import { useMemo } from 'react';
import omit from 'lodash/omit';
// @mui
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import Tabs from '@mui/material/Tabs';
// hooks
import {
  intParam,
  stringParam,
  useSyncTableWithUrlListState,
  useUrlListState,
  useUrlQueryState,
} from 'src/hooks/use-url-query-state';
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import {
  TableHeadCustom,
  TableNoData,
  TablePaginationCustom,
  useTable,
} from 'src/components/table';
import { useRouter } from 'src/routes/hook';
import { paths } from 'src/routes/paths';
//
import { fDate } from 'src/utils/format-time';
import { downloadBlob } from 'src/utils/download-file';
//
import { useExportResultsMutation, useResultsQuery } from './api/use-results-api';
import type { ModuleCode, ResultListParams, TestSessionRow } from './api/types';
import { ResultTableRow, ResultsTableToolbar } from './components';
import { MODULE_LABEL_KEYS, MODULE_OPTIONS } from './components/utils/module-label';
import { ResultsTableSkeleton } from './skeleton';

// ----------------------------------------------------------------------

const FILTERS_SCHEMA = {
  employee: stringParam(''),
  module: stringParam(''),
  specialty: stringParam(''),
  passed: stringParam(''),
  date: stringParam(''),
  page: intParam(1),
};

/** Maps a sort column id to the backend `ordering` field name. */
const ORDERING_MAP: Record<string, string> = {
  employeeName: 'employee__full_name',
  score: 'score',
  startedAt: 'started_at',
};

export default function ResultsView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const router = useRouter();
  const { canDetailPage } = useCheckPermission();

  const canDetail = canDetailPage('results');

  const table = useTable();
  const list = useUrlListState({ defaultPageSize: 15, defaultOrdering: '-started_at' });
  useSyncTableWithUrlListState({
    page: list.page,
    rowsPerPage: list.rowsPerPage,
    tablePage: table.page,
    tableRowsPerPage: table.rowsPerPage,
    setTablePage: table.setPage,
    setTableRowsPerPage: table.setRowsPerPage,
  });

  const filters = useUrlQueryState(FILTERS_SCHEMA);

  // Active tab is the module filter; default to first module.
  const activeModule = (MODULE_OPTIONS.find((m) => m === filters.values.module) ??
    MODULE_OPTIONS[0]) as ModuleCode;

  const handleTabChange = (_: React.SyntheticEvent, value: ModuleCode) => {
    filters.setValues({ module: value, page: 1 });
  };

  const handleSort = (columnId: string) => {
    const field = ORDERING_MAP[columnId];
    if (!field) return;
    const current = list.ordering;
    let next: string;
    if (current === field) {
      next = `-${field}`;
    } else if (current === `-${field}`) {
      next = '-started_at';
    } else {
      next = field;
    }
    list.setOrdering(next);
    filters.setValues({ page: 1 });
  };

  /** Derive `order` / `orderBy` for TableHeadCustom from the URL ordering string. */
  const { ordering } = list;
  const sortState = useMemo(() => {
    if (!ordering || ordering === '-started_at') return { order: 'desc' as const, orderBy: 'startedAt' };
    const desc = ordering.startsWith('-');
    const field = desc ? ordering.slice(1) : ordering;
    const columnId = Object.keys(ORDERING_MAP).find((k) => ORDERING_MAP[k] === field);
    return { order: (desc ? 'desc' : 'asc') as 'asc' | 'desc', orderBy: columnId ?? '' };
  }, [ordering]);

  const queryParams = useMemo<ResultListParams>(
    () => ({
      page: list.page,
      pageSize: list.rowsPerPage,
      module: activeModule,
      ...(filters.values.employee ? { employee: Number(filters.values.employee) } : {}),
      // Specialty is a per-session snapshot that only exists on the specialty module.
      ...(activeModule === 'specialty' && filters.values.specialty
        ? { specialty: Number(filters.values.specialty) }
        : {}),
      ...(filters.values.passed ? { passed: filters.values.passed === 'true' } : {}),
      ...(filters.values.date ? { date: filters.values.date } : {}),
      ...(list.ordering && list.ordering !== '-started_at' ? { ordering: list.ordering } : {}),
    }),
    [
      activeModule,
      filters.values.date,
      filters.values.employee,
      filters.values.specialty,
      filters.values.passed,
      list.ordering,
      list.page,
      list.rowsPerPage,
    ]
  );

  const resultsQuery = useResultsQuery(queryParams);
  const rows = resultsQuery.data?.results ?? [];
  const count = resultsQuery.data?.count ?? 0;
  const isLoading = resultsQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const handleView = (row: TestSessionRow) => {
    if (!canDetail) return;
    router.push(paths.app.results.detail(row.id));
  };

  const exportMutation = useExportResultsMutation();

  const handleExport = () => {
    exportMutation.mutate(omit(queryParams, ['page', 'pageSize', 'ordering']), {
      onSuccess: (blob) => {
        downloadBlob(blob, `test-results-${fDate(new Date(), 'yyyyMMdd')}.xlsx`);
      },
    });
  };

  const headLabel = [
    { id: 'employeeName', label: tx('results.table.employee') },
    { id: 'specialtyName', label: tx('results.table.specialty'), width: 200 },
    { id: 'score', label: tx('results.table.score'), width: 100 },
    { id: 'passed', label: tx('results.table.status'), width: 120 },
    { id: 'startedAt', label: tx('results.table.startedAt'), width: 160 },
    ...(canDetail ? [{ id: 'actions', label: '', width: 64, align: 'right' as const }] : []),
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('results.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('results.title') }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <Tabs
          value={activeModule}
          onChange={handleTabChange}
          sx={{ px: 2.5, borderBottom: 1, borderColor: 'divider' }}
        >
          {MODULE_OPTIONS.map((mod) => (
            <Tab key={mod} value={mod} label={tx(MODULE_LABEL_KEYS[mod])} />
          ))}
        </Tabs>

        <ResultsTableToolbar
          employee={filters.values.employee}
          onEmployee={(value) => filters.setValues({ employee: value, page: 1 })}
          showSpecialty={activeModule === 'specialty'}
          specialty={filters.values.specialty}
          onSpecialty={(value) => filters.setValues({ specialty: value, page: 1 })}
          passed={filters.values.passed}
          onPassed={(value) => filters.setValues({ passed: value, page: 1 })}
          date={filters.values.date}
          onDate={(value) => filters.setValues({ date: value, page: 1 })}
          onExport={handleExport}
          exporting={exportMutation.isPending}
        />

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium" sx={{ minWidth: 800 }}>
              <TableHeadCustom
                headLabel={headLabel}
                order={sortState.order}
                orderBy={sortState.orderBy}
                onSort={handleSort}
              />
              <TableBody>
                {isLoading && <ResultsTableSkeleton rows={list.rowsPerPage} />}

                {!isLoading &&
                  rows.map((row) => (
                    <ResultTableRow
                      key={row.id}
                      row={row}
                      canDetail={canDetail}
                      onView={handleView}
                    />
                  ))}

                <TableNoData notFound={notFound} title={tx('results.empty')} />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={count}
          page={table.page}
          rowsPerPage={table.rowsPerPage}
          onPageChange={list.handlePageChange}
          onRowsPerPageChange={list.handleRowsPerPageChange}
          rowsPerPageOptions={[15, 25, 50]}
        />
      </Card>
    </Container>
  );
}
