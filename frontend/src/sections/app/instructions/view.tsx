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
import { useDeleteInstructionMutation, useInstructionsQuery } from './api/use-instructions-api';
import type { Instruction, InstructionListParams } from './api/types';
import {
  GenerateQuestionsDialog,
  InstructionTableRow,
  InstructionsTableToolbar,
  InstructionUploadDialog,
} from './components';
import { InstructionsTableSkeleton } from './skeleton';

// ----------------------------------------------------------------------

const SORTABLE_COLUMNS = ['title', 'created_at'];

/** Extra list filters live in the URL next to page/search/ordering (module-level schema). */
const FILTERS_SCHEMA = {
  specialty: stringParam(''),
  generation_status: stringParam(''),
  page: intParam(1),
};

export default function InstructionsView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { canWritePage } = useCheckPermission();

  const canWrite = canWritePage('instructions');

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

  const queryParams = useMemo<InstructionListParams>(
    () => ({
      page: list.page,
      pageSize: list.rowsPerPage,
      ordering: list.ordering,
      ...(list.search ? { search: list.search } : {}),
      ...(filters.values.specialty ? { specialty: Number(filters.values.specialty) } : {}),
      ...(filters.values.generation_status
        ? { generationStatus: filters.values.generation_status }
        : {}),
    }),
    [
      filters.values.generation_status,
      filters.values.specialty,
      list.ordering,
      list.page,
      list.rowsPerPage,
      list.search,
    ]
  );

  const instructionsQuery = useInstructionsQuery(queryParams);
  const rows = instructionsQuery.data?.results ?? [];
  const count = instructionsQuery.data?.count ?? 0;
  const isLoading = instructionsQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const deleteMutation = useDeleteInstructionMutation();

  const uploadDialog = useBoolean();
  const generateDialog = useBoolean();
  const [generating, setGenerating] = useState<Instruction | null>(null);
  const [deleting, setDeleting] = useState<Instruction | null>(null);

  const orderBy = list.ordering.startsWith('-') ? list.ordering.slice(1) : list.ordering;
  const order: 'asc' | 'desc' = list.ordering.startsWith('-') ? 'desc' : 'asc';

  const handleSort = (columnId: string) => {
    if (!SORTABLE_COLUMNS.includes(columnId)) return;
    const next = orderBy === columnId && order === 'asc' ? `-${columnId}` : columnId;
    list.setOrdering(next);
  };

  const handleUploaded = (instruction: Instruction) => {
    instructionsQuery.addItem(instruction);
  };

  const handleOpenGenerate = (instruction: Instruction) => {
    setGenerating(instruction);
    generateDialog.onTrue();
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        instructionsQuery.deleteItem(deleting.id);
        enqueueSnackbar(tx('instructions.toasts.deleted'));
        setDeleting(null);
      },
    });
  };

  const headLabel = [
    { id: 'title', label: tx('instructions.table.title') },
    { id: 'specialty', label: tx('instructions.table.specialty'), width: 200 },
    { id: 'generation_status', label: tx('instructions.table.generationStatus'), width: 160 },
    { id: 'last_generated_at', label: tx('instructions.table.lastGeneratedAt'), width: 180 },
    { id: 'created_at', label: tx('instructions.table.created'), width: 130 },
    { id: 'file', label: tx('instructions.table.file'), width: 80, align: 'center' as const },
    ...(canWrite ? [{ id: 'actions', label: '', width: 64, align: 'right' as const }] : []),
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('instructions.title')}
        links={[
          { name: tx('common.appName'), href: paths.home },
          { name: tx('instructions.title') },
        ]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="eva:cloud-upload-fill" />}
              onClick={uploadDialog.onTrue}
            >
              {tx('instructions.actions.upload')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <InstructionsTableToolbar
          search={searchInput}
          onSearch={setSearchInput}
          specialty={filters.values.specialty}
          onSpecialty={(value) => filters.setValues({ specialty: value, page: 1 })}
          generationStatus={filters.values.generation_status}
          onGenerationStatus={(value) => filters.setValues({ generation_status: value, page: 1 })}
          specialtyOptions={specialtyOptions}
        />

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium" sx={{ minWidth: 960 }}>
              <TableHeadCustom
                order={order}
                orderBy={orderBy}
                headLabel={headLabel}
                onSort={handleSort}
              />
              <TableBody>
                {isLoading && <InstructionsTableSkeleton rows={list.rowsPerPage} />}

                {!isLoading &&
                  rows.map((row) => (
                    <InstructionTableRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                      onGenerate={handleOpenGenerate}
                      onDelete={setDeleting}
                    />
                  ))}

                <TableNoData notFound={notFound} title={tx('instructions.empty')} />
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

      <InstructionUploadDialog
        open={uploadDialog.value}
        onClose={uploadDialog.onFalse}
        onUploaded={handleUploaded}
      />

      <GenerateQuestionsDialog
        open={generateDialog.value}
        onClose={generateDialog.onFalse}
        instruction={generating}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx('instructions.dialogs.delete.title')}
        content={tx('instructions.dialogs.delete.content', { title: deleting?.title ?? '' })}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
          >
            {tx('instructions.dialogs.delete.confirm')}
          </Button>
        }
      />
    </Container>
  );
}
