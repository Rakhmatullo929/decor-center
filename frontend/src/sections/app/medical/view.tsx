import { useMemo } from 'react';
import omit from 'lodash/omit';
// @mui
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
// hooks
import { useBoolean } from 'src/hooks/use-boolean';
import {
  intParam,
  stringParam,
  useSyncTableWithUrlListState,
  useUrlListState,
  useUrlQueryState,
} from 'src/hooks/use-url-query-state';
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
import { useRouter } from 'src/routes/hook';
import { paths } from 'src/routes/paths';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import {
  TableHeadCustom,
  TableNoData,
  TablePaginationCustom,
  useTable,
} from 'src/components/table';
//
import { fDate } from 'src/utils/format-time';
import { downloadBlob } from 'src/utils/download-file';
//
import { useExportMedicalChecksMutation, useMedicalChecksQuery } from './api/use-medical-api';
import type { MedicalCheck, MedicalCheckListParams } from './api/types';
import { EmployeeSelectDialog, MedicalTableRow, MedicalTableToolbar } from './components';
import { MedicalTableSkeleton } from './skeleton';

// ----------------------------------------------------------------------

const SORTABLE_COLUMNS = ['created_at'];

const FILTERS_SCHEMA = {
  employee: stringParam(''),
  conclusion: stringParam(''),
  date: stringParam(''),
  page: intParam(1),
};

export default function MedicalView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const router = useRouter();
  const { canWritePage } = useCheckPermission();

  const canWrite = canWritePage('medical');

  const table = useTable();
  const list = useUrlListState({ defaultPageSize: 15, defaultOrdering: '-created_at' });
  useSyncTableWithUrlListState({
    page: list.page,
    rowsPerPage: list.rowsPerPage,
    tablePage: table.page,
    tableRowsPerPage: table.rowsPerPage,
    setTablePage: table.setPage,
    setTableRowsPerPage: table.setRowsPerPage,
  });

  const filters = useUrlQueryState(FILTERS_SCHEMA);

  const queryParams = useMemo<MedicalCheckListParams>(
    () => ({
      page: list.page,
      pageSize: list.rowsPerPage,
      ordering: list.ordering,
      ...(filters.values.employee ? { employee: Number(filters.values.employee) } : {}),
      ...(filters.values.conclusion === 'approved' || filters.values.conclusion === 'rejected'
        ? { conclusion: filters.values.conclusion }
        : {}),
      ...(filters.values.date ? { date: filters.values.date } : {}),
    }),
    [
      filters.values.conclusion,
      filters.values.date,
      filters.values.employee,
      list.ordering,
      list.page,
      list.rowsPerPage,
    ]
  );

  const checksQuery = useMedicalChecksQuery(queryParams);
  const rows = checksQuery.data?.results ?? [];
  const count = checksQuery.data?.count ?? 0;
  const isLoading = checksQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const employeeSelectDialog = useBoolean();
  const exportMutation = useExportMedicalChecksMutation();

  const handleExport = () => {
    exportMutation.mutate(omit(queryParams, ['page', 'pageSize']), {
      onSuccess: (blob) => {
        downloadBlob(blob, `medical-checks-${fDate(new Date(), 'yyyyMMdd')}.xlsx`);
      },
    });
  };

  const orderBy = list.ordering.startsWith('-') ? list.ordering.slice(1) : list.ordering;
  const order: 'asc' | 'desc' = list.ordering.startsWith('-') ? 'desc' : 'asc';

  const handleSort = (columnId: string) => {
    if (!SORTABLE_COLUMNS.includes(columnId)) return;
    const next = orderBy === columnId && order === 'asc' ? `-${columnId}` : columnId;
    list.setOrdering(next);
  };

  const handleDetail = (check: MedicalCheck) => router.push(paths.app.medical.detail(check.id));
  const handleEdit = (check: MedicalCheck) => router.push(paths.app.medical.edit(check.id));

  const headLabel = [
    { id: 'employee', label: tx('medical.table.employee') },
    { id: 'bp', label: tx('medical.table.bp'), width: 100 },
    { id: 'pulse', label: tx('medical.table.pulse'), width: 80 },
    { id: 'saturation', label: tx('medical.table.saturation'), width: 110 },
    { id: 'alcohol', label: tx('medical.table.alcohol'), width: 100 },
    { id: 'hours_worked', label: tx('medical.table.hoursWorked'), width: 110 },
    { id: 'hours_rested', label: tx('medical.table.hoursRested'), width: 110 },
    { id: 'conclusion', label: tx('medical.table.conclusion'), width: 130 },
    { id: 'medic', label: tx('medical.table.medic'), width: 120 },
    { id: 'created_at', label: tx('medical.table.created'), width: 160 },
    { id: 'actions', label: '', width: 64, align: 'right' as const },
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('medical.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('medical.title') }]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={employeeSelectDialog.onTrue}
            >
              {tx('medical.actions.create')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <MedicalTableToolbar
          employee={filters.values.employee}
          onEmployee={(value) => filters.setValues({ employee: value, page: 1 })}
          conclusion={filters.values.conclusion}
          onConclusion={(value) => filters.setValues({ conclusion: value, page: 1 })}
          date={filters.values.date}
          onDate={(value) => filters.setValues({ date: value, page: 1 })}
          onExport={handleExport}
          exporting={exportMutation.isPending}
        />

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium" sx={{ minWidth: 1100 }}>
              <TableHeadCustom
                order={order}
                orderBy={orderBy}
                headLabel={headLabel}
                onSort={handleSort}
              />
              <TableBody>
                {isLoading && <MedicalTableSkeleton rows={list.rowsPerPage} />}

                {!isLoading &&
                  rows.map((row) => (
                    <MedicalTableRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                      onDetail={handleDetail}
                      onEdit={handleEdit}
                    />
                  ))}

                <TableNoData notFound={notFound} title={tx('medical.empty')} />
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

      <EmployeeSelectDialog
        open={employeeSelectDialog.value}
        onClose={employeeSelectDialog.onFalse}
      />
    </Container>
  );
}
