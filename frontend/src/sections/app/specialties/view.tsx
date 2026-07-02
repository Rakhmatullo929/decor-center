import { useEffect, useState } from 'react';
// @mui
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
// hooks
import { useBoolean } from 'src/hooks/use-boolean';
import { useDebounce } from 'src/hooks/use-debounce';
import { useSnackbar } from 'src/components/snackbar';
import { useUrlListState, useSyncTableWithUrlListState } from 'src/hooks/use-url-query-state';
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { ConfirmDialog } from 'src/components/custom-dialog';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import {
  TableHeadCustom,
  TableNoData,
  TablePaginationCustom,
  useTable,
} from 'src/components/table';
import { paths } from 'src/routes/paths';
//
import { useSpecialtiesQuery, useDeleteSpecialtyMutation } from './api/use-specialties-api';
import type { Specialty } from './api/types';
import { SpecialtyUpsertDialog, SpecialtyTableRow } from './components';
import { SpecialtiesTableSkeleton } from './skeleton';

// ----------------------------------------------------------------------

const SORTABLE_COLUMNS = ['name', 'created_at'];

export default function SpecialtiesView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { canWritePage } = useCheckPermission();

  const canWrite = canWritePage('specialties');

  const table = useTable();
  const list = useUrlListState({ defaultPageSize: 15, defaultOrdering: 'name' });
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
    if (debouncedSearch !== list.search) {
      list.setSearch(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const queryParams = {
    page: list.page,
    pageSize: list.rowsPerPage,
    ordering: list.ordering,
    ...(list.search ? { search: list.search } : {}),
  };

  const specialtiesQuery = useSpecialtiesQuery(queryParams);
  const rows = specialtiesQuery.data?.results ?? [];
  const count = specialtiesQuery.data?.count ?? 0;
  const isLoading = specialtiesQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const deleteMutation = useDeleteSpecialtyMutation();

  const upsertDialog = useBoolean();
  const [editing, setEditing] = useState<Specialty | null>(null);
  const [deleting, setDeleting] = useState<Specialty | null>(null);

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

  const handleOpenEdit = (specialty: Specialty) => {
    setEditing(specialty);
    upsertDialog.onTrue();
  };

  const handleSaved = (specialty: Specialty, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      specialtiesQuery.addItem(specialty);
    } else {
      specialtiesQuery.updateItem(specialty);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        specialtiesQuery.deleteItem(deleting.id);
        enqueueSnackbar(tx('specialties.toasts.deleted'));
        setDeleting(null);
      },
    });
  };

  const headLabel = [
    { id: 'name', label: tx('specialties.table.name') },
    { id: 'is_active', label: tx('specialties.table.status'), width: 120 },
    { id: 'created_at', label: tx('specialties.table.created'), width: 140 },
    ...(canWrite ? [{ id: 'actions', label: '', width: 112, align: 'right' as const }] : []),
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('specialties.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('specialties.title') }]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={handleOpenCreate}
            >
              {tx('specialties.actions.create')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <Stack direction="row" alignItems="center" sx={{ p: 2.5 }}>
          <TextField
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={tx('specialties.searchPlaceholder')}
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
            <Table size="medium" sx={{ minWidth: 640 }}>
              <TableHeadCustom
                order={order}
                orderBy={orderBy}
                headLabel={headLabel}
                onSort={handleSort}
              />
              <TableBody>
                {isLoading && <SpecialtiesTableSkeleton rows={list.rowsPerPage} />}

                {!isLoading &&
                  rows.map((row) => (
                    <SpecialtyTableRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                      onEdit={handleOpenEdit}
                      onDelete={setDeleting}
                    />
                  ))}

                <TableNoData notFound={notFound} title={tx('specialties.empty')} />
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

      <SpecialtyUpsertDialog
        open={upsertDialog.value}
        onClose={upsertDialog.onFalse}
        specialty={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx('specialties.dialogs.delete.title')}
        content={tx('specialties.dialogs.delete.content')}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
          >
            {tx('specialties.dialogs.delete.confirm')}
          </Button>
        }
      />
    </Container>
  );
}
