import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import { useBoolean } from 'src/hooks/use-boolean';
import { useDebounce } from 'src/hooks/use-debounce';
import { useSnackbar } from 'src/components/snackbar';
import { useUrlListState, useSyncTableWithUrlListState } from 'src/hooks/use-url-query-state';
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { ConfirmDialog } from 'src/components/custom-dialog';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { TableHeadCustom, TableNoData, TablePaginationCustom, useTable } from 'src/components/table';
import { paths } from 'src/routes/paths';
import { useTestsQuery, useDeleteTestMutation } from '../api/use-surveys-api';
import type { Test } from '../api/types';
import { TestUpsertDialog, TestTableRow } from './components';

const SORTABLE_COLUMNS = ['title'];

export default function TestsView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { canWritePage } = useCheckPermission();
  const canWrite = canWritePage('tests');

  const table = useTable();
  const list = useUrlListState({ defaultPageSize: 15, defaultOrdering: 'title' });
  useSyncTableWithUrlListState({
    page: list.page,
    rowsPerPage: list.rowsPerPage,
    tablePage: table.page,
    tableRowsPerPage: table.rowsPerPage,
    setTablePage: table.setPage,
    setTableRowsPerPage: table.setRowsPerPage,
  });

  const [searchInput, setSearchInput] = useState(list.search);
  const debouncedSearch = useDebounce(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== list.search) list.setSearch(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const testsQuery = useTestsQuery({
    page: list.page,
    pageSize: list.rowsPerPage,
    ordering: list.ordering,
    ...(list.search ? { search: list.search } : {}),
  });
  const rows = testsQuery.data?.results ?? [];
  const count = testsQuery.data?.count ?? 0;
  const isLoading = testsQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const deleteMutation = useDeleteTestMutation();
  const upsertDialog = useBoolean();
  const [editing, setEditing] = useState<Test | null>(null);
  const [deleting, setDeleting] = useState<Test | null>(null);

  const orderBy = list.ordering.startsWith('-') ? list.ordering.slice(1) : list.ordering;
  const order: 'asc' | 'desc' = list.ordering.startsWith('-') ? 'desc' : 'asc';
  const handleSort = (columnId: string) => {
    if (!SORTABLE_COLUMNS.includes(columnId)) return;
    list.setOrdering(orderBy === columnId && order === 'asc' ? `-${columnId}` : columnId);
  };

  const handleSaved = (test: Test, mode: 'create' | 'edit') => {
    if (mode === 'create') testsQuery.addItem(test);
    else testsQuery.updateItem(test);
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        testsQuery.deleteItem(deleting.id);
        enqueueSnackbar(tx('surveys.tests.toasts.deleted'));
        setDeleting(null);
      },
    });
  };

  const headLabel = [
    { id: 'title', label: tx('surveys.tests.table.title') },
    { id: 'schedule', label: tx('surveys.tests.table.schedule'), width: 320 },
    { id: 'is_active', label: tx('surveys.tests.table.status'), width: 120 },
    { id: 'actions', label: '', width: 64, align: 'right' as const },
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.tests.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('surveys.tests.title') }]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => {
                setEditing(null);
                upsertDialog.onTrue();
              }}
            >
              {tx('surveys.tests.actions.create')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <Stack direction="row" alignItems="center" sx={{ p: 2.5 }}>
          <TextField
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={tx('surveys.tests.searchPlaceholder')}
            size="small"
            sx={{ width: { xs: 1, sm: 320 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium" sx={{ minWidth: 720 }}>
              <TableHeadCustom order={order} orderBy={orderBy} headLabel={headLabel} onSort={handleSort} />
              <TableBody>
                {!isLoading &&
                  rows.map((row) => (
                    <TestTableRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                      onEdit={(t) => {
                        setEditing(t);
                        upsertDialog.onTrue();
                      }}
                      onDelete={setDeleting}
                    />
                  ))}
                <TableNoData notFound={notFound} title={tx('surveys.tests.empty')} />
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

      <TestUpsertDialog
        open={upsertDialog.value}
        onClose={upsertDialog.onFalse}
        test={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx('surveys.tests.dialogs.delete.title')}
        content={tx('surveys.tests.dialogs.delete.content')}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
            {tx('common.actions.delete')}
          </Button>
        }
      />
    </Container>
  );
}
