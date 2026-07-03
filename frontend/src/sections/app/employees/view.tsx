import { useEffect, useMemo, useState } from 'react';
// @mui
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
// hooks
import { useBoolean } from 'src/hooks/use-boolean';
import { useDebounce } from 'src/hooks/use-debounce';
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
import { ConfirmDialog } from 'src/components/custom-dialog';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import {
  TableHeadCustom,
  TableNoData,
  TablePaginationCustom,
  useTable,
} from 'src/components/table';
import { paths } from 'src/routes/paths';
//
import { useSpecialtyOptionsQuery } from '../specialties/api/use-specialties-api';
import { useEmployeesQuery, useToggleEmployeeActiveMutation } from './api/use-employees-api';
import type { Employee, EmployeeListParams } from './api/types';
import {
  EmployeeTableRow,
  EmployeesTableToolbar,
  EmployeeUpsertDialog,
} from './components';
import { EmployeesTableSkeleton } from './skeleton';

// ----------------------------------------------------------------------

const SORTABLE_COLUMNS = ['full_name', 'hire_date', 'created_at'];

/** Extra list filters live in the URL next to page/search/ordering (module-level schema). */
const FILTERS_SCHEMA = {
  specialty: stringParam(''),
  is_active: stringParam(''),
  page: intParam(1),
};

export default function EmployeesView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { canWritePage } = useCheckPermission();

  const canWrite = canWritePage('employees');

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

  const [searchInput, setSearchInput] = useState(list.search);
  const debouncedSearch = useDebounce(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== list.search) {
      list.setSearch(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const queryParams = useMemo<EmployeeListParams>(
    () => ({
      page: list.page,
      pageSize: list.rowsPerPage,
      ordering: list.ordering,
      ...(list.search ? { search: list.search } : {}),
      ...(filters.values.specialty ? { specialty: Number(filters.values.specialty) } : {}),
      ...(filters.values.is_active ? { isActive: filters.values.is_active === 'true' } : {}),
    }),
    [filters.values.is_active, filters.values.specialty, list.ordering, list.page, list.rowsPerPage, list.search]
  );

  const employeesQuery = useEmployeesQuery(queryParams);
  const rows = employeesQuery.data?.results ?? [];
  const count = employeesQuery.data?.count ?? 0;
  const isLoading = employeesQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const toggleActiveMutation = useToggleEmployeeActiveMutation();

  const upsertDialog = useBoolean();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [archiving, setArchiving] = useState<Employee | null>(null);

  const orderBy = list.ordering.startsWith('-') ? list.ordering.slice(1) : list.ordering;
  const order: 'asc' | 'desc' = list.ordering.startsWith('-') ? 'desc' : 'asc';

  const handleSort = (columnId: string) => {
    if (!SORTABLE_COLUMNS.includes(columnId)) return;
    const next = orderBy === columnId && order === 'asc' ? `-${columnId}` : columnId;
    list.setOrdering(next);
  };

  const handleOpenCreate = () => {
    setEditing(null);
    upsertDialog.onTrue();
  };

  const handleOpenEdit = (employee: Employee) => {
    setEditing(employee);
    upsertDialog.onTrue();
  };

  const handleSaved = (employee: Employee, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      employeesQuery.addItem(employee);
    } else {
      employeesQuery.updateItem(employee);
    }
  };

  const handleToggleActive = (employee: Employee) => {
    if (employee.isActive) {
      // Archiving hides the employee from testing/medical lists — confirm first.
      setArchiving(employee);
      return;
    }
    toggleActiveMutation.mutate(
      { id: employee.id, isActive: true },
      {
        onSuccess: (updated) => {
          employeesQuery.updateItem(updated);
          enqueueSnackbar(tx('employees.toasts.activated'));
        },
      }
    );
  };

  const handleConfirmArchive = () => {
    if (!archiving) return;
    toggleActiveMutation.mutate(
      { id: archiving.id, isActive: false },
      {
        onSuccess: (updated) => {
          employeesQuery.updateItem(updated);
          enqueueSnackbar(tx('employees.toasts.archived'));
          setArchiving(null);
        },
      }
    );
  };

  const headLabel = [
    { id: 'full_name', label: tx('employees.table.fullName') },
    { id: 'specialty', label: tx('employees.table.specialty'), width: 200 },
    { id: 'hire_date', label: tx('employees.table.hireDate'), width: 140 },
    { id: 'work_experience', label: tx('employees.table.workExperience'), width: 100 },
    { id: 'is_active', label: tx('employees.table.status'), width: 120 },
    { id: 'created_at', label: tx('employees.table.created'), width: 140 },
    ...(canWrite ? [{ id: 'actions', label: '', width: 64, align: 'right' as const }] : []),
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('employees.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('employees.title') }]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={handleOpenCreate}
            >
              {tx('employees.actions.create')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <EmployeesTableToolbar
          search={searchInput}
          onSearch={setSearchInput}
          specialty={filters.values.specialty}
          onSpecialty={(value) => filters.setValues({ specialty: value, page: 1 })}
          status={filters.values.is_active}
          onStatus={(value) => filters.setValues({ is_active: value, page: 1 })}
          specialtyOptions={specialtyOptions}
        />

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium" sx={{ minWidth: 800 }}>
              <TableHeadCustom
                order={order}
                orderBy={orderBy}
                headLabel={headLabel}
                onSort={handleSort}
              />
              <TableBody>
                {isLoading && <EmployeesTableSkeleton rows={list.rowsPerPage} />}

                {!isLoading &&
                  rows.map((row) => (
                    <EmployeeTableRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                      onEdit={handleOpenEdit}
                      onToggleActive={handleToggleActive}
                    />
                  ))}

                <TableNoData notFound={notFound} title={tx('employees.empty')} />
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

      <EmployeeUpsertDialog
        open={upsertDialog.value}
        onClose={upsertDialog.onFalse}
        employee={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        title={tx('employees.dialogs.archive.title')}
        content={tx('employees.dialogs.archive.content', { name: archiving?.fullName ?? '' })}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmArchive}
            disabled={toggleActiveMutation.isPending}
          >
            {tx('employees.dialogs.archive.confirm')}
          </Button>
        }
      />
    </Container>
  );
}
