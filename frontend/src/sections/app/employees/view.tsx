import { useEffect, useMemo, useState } from 'react';
// @mui
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
import {
  useDeleteEmployeeMutation,
  useEmployeesQuery,
  useToggleEmployeeActiveMutation,
} from './api/use-employees-api';
import type { Employee, EmployeeListParams } from './api/types';
import {
  EmployeeTableRow,
  EmployeesTableToolbar,
  EmployeeUpsertDialog,
} from './components';
import { EmployeesTableSkeleton } from './skeleton';

// ----------------------------------------------------------------------

const SORTABLE_COLUMNS = ['full_name', 'hire_date'];

/**
 * Extra list filters live in the URL next to page/search/ordering (module-level schema).
 * `is_active` defaults to `'true'` so the page opens on the Active tab; the value doubles
 * as the selected tab and survives a page refresh via the URL.
 */
const FILTERS_SCHEMA = {
  specialty: stringParam(''),
  is_active: stringParam('true'),
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
  const activeTab = filters.values.is_active === 'false' ? 'false' : 'true';

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
      isActive: activeTab === 'true',
    }),
    [activeTab, filters.values.specialty, list.ordering, list.page, list.rowsPerPage, list.search]
  );

  const employeesQuery = useEmployeesQuery(queryParams);
  const rows = employeesQuery.data?.results ?? [];
  const count = employeesQuery.data?.count ?? 0;
  const isLoading = employeesQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const toggleActiveMutation = useToggleEmployeeActiveMutation();
  const deleteMutation = useDeleteEmployeeMutation();

  const upsertDialog = useBoolean();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deactivating, setDeactivating] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const orderBy = list.ordering.startsWith('-') ? list.ordering.slice(1) : list.ordering;
  const order: 'asc' | 'desc' = list.ordering.startsWith('-') ? 'desc' : 'asc';

  const handleSort = (columnId: string) => {
    if (!SORTABLE_COLUMNS.includes(columnId)) return;
    const next = orderBy === columnId && order === 'asc' ? `-${columnId}` : columnId;
    list.setOrdering(next);
  };

  const handleTabChange = (_event: React.SyntheticEvent, value: string) => {
    filters.setValues({ is_active: value, page: 1 });
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
      // Deactivating hides the employee from testing/medical lists — confirm first.
      setDeactivating(employee);
      return;
    }
    toggleActiveMutation.mutate(
      { id: employee.id, isActive: true },
      {
        onSuccess: () => {
          // The employee no longer matches the current (inactive) tab — drop the row.
          employeesQuery.deleteItem(employee.id);
          enqueueSnackbar(tx('employees.toasts.activated'));
        },
      }
    );
  };

  const handleConfirmDeactivate = () => {
    if (!deactivating) return;
    toggleActiveMutation.mutate(
      { id: deactivating.id, isActive: false },
      {
        onSuccess: () => {
          // The employee no longer matches the current (active) tab — drop the row.
          employeesQuery.deleteItem(deactivating.id);
          enqueueSnackbar(tx('employees.toasts.deactivated'));
          setDeactivating(null);
        },
      }
    );
  };

  const handleDelete = (employee: Employee) => {
    setDeleting(employee);
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        employeesQuery.deleteItem(deleting.id);
        enqueueSnackbar(tx('employees.toasts.deleted'));
        setDeleting(null);
      },
    });
  };

  const headLabel = [
    { id: 'full_name', label: tx('employees.table.fullName') },
    { id: 'specialty', label: tx('employees.table.specialty'), width: 220 },
    { id: 'hire_date', label: tx('employees.table.workExperience'), width: 160 },
    { id: 'is_active', label: tx('employees.table.status'), width: 130 },
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
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ px: 2.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="true" label={tx('employees.tabs.active')} />
          <Tab value="false" label={tx('employees.tabs.inactive')} />
        </Tabs>

        <EmployeesTableToolbar
          search={searchInput}
          onSearch={setSearchInput}
          specialty={filters.values.specialty}
          onSpecialty={(value) => filters.setValues({ specialty: value, page: 1 })}
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
                      onDelete={handleDelete}
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
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        title={tx('employees.dialogs.deactivate.title')}
        content={tx('employees.dialogs.deactivate.content', { name: deactivating?.fullName ?? '' })}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeactivate}
            disabled={toggleActiveMutation.isPending}
          >
            {tx('employees.dialogs.deactivate.confirm')}
          </Button>
        }
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx('employees.dialogs.delete.title')}
        content={tx('employees.dialogs.delete.content', { name: deleting?.fullName ?? '' })}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
          >
            {tx('employees.dialogs.delete.confirm')}
          </Button>
        }
      />
    </Container>
  );
}
