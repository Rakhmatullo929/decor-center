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
import {
  useApproveQuestionMutation,
  useDeleteQuestionMutation,
  useQuestionsQuery,
} from './api/use-questions-api';
import type { Question, QuestionListParams } from './api/types';
import { QuestionTableRow, QuestionsTableToolbar, QuestionUpsertDialog } from './components';
import { QuestionsTableSkeleton } from './skeleton';

// ----------------------------------------------------------------------

const SORTABLE_COLUMNS = ['created_at'];

/** Extra list filters live in the URL next to page/search/ordering (module-level schema). */
const FILTERS_SCHEMA = {
  module: stringParam(''),
  specialty: stringParam(''),
  status: stringParam(''),
  source: stringParam(''),
  page: intParam(1),
};

export default function QuestionsView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { canWritePage } = useCheckPermission();

  const canWrite = canWritePage('questions');

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

  const queryParams = useMemo<QuestionListParams>(
    () => ({
      page: list.page,
      pageSize: list.rowsPerPage,
      ordering: list.ordering,
      ...(list.search ? { search: list.search } : {}),
      ...(filters.values.module ? { module: filters.values.module } : {}),
      ...(filters.values.specialty ? { specialty: Number(filters.values.specialty) } : {}),
      ...(filters.values.status ? { status: filters.values.status } : {}),
      ...(filters.values.source ? { source: filters.values.source } : {}),
    }),
    [
      filters.values.module,
      filters.values.source,
      filters.values.specialty,
      filters.values.status,
      list.ordering,
      list.page,
      list.rowsPerPage,
      list.search,
    ]
  );

  const questionsQuery = useQuestionsQuery(queryParams);
  const rows = questionsQuery.data?.results ?? [];
  const count = questionsQuery.data?.count ?? 0;
  const isLoading = questionsQuery.isPending;
  const notFound = !isLoading && rows.length === 0;

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const approveMutation = useApproveQuestionMutation();
  const deleteMutation = useDeleteQuestionMutation();

  const upsertDialog = useBoolean();
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);

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

  const handleOpenEdit = (question: Question) => {
    setEditing(question);
    upsertDialog.onTrue();
  };

  const handleSaved = (question: Question, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      questionsQuery.addItem(question);
    } else {
      questionsQuery.updateItem(question);
    }
  };

  const handleApprove = (question: Question) => {
    approveMutation.mutate(question.id, {
      onSuccess: (approved) => {
        questionsQuery.updateItem(approved);
        enqueueSnackbar(tx('questions.toasts.approved'));
      },
    });
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        questionsQuery.deleteItem(deleting.id);
        enqueueSnackbar(tx('questions.toasts.deleted'));
        setDeleting(null);
      },
    });
  };

  const headLabel = [
    { id: 'text', label: tx('questions.table.text') },
    { id: 'module', label: tx('questions.table.module'), width: 200 },
    { id: 'specialty', label: tx('questions.table.specialty'), width: 200 },
    { id: 'source', label: tx('questions.table.source'), width: 110 },
    { id: 'status', label: tx('questions.table.status'), width: 140 },
    { id: 'created_at', label: tx('questions.table.created'), width: 130 },
    ...(canWrite ? [{ id: 'actions', label: '', width: 64, align: 'right' as const }] : []),
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('questions.title')}
        links={[{ name: tx('common.appName'), href: paths.home }, { name: tx('questions.title') }]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={handleOpenCreate}
            >
              {tx('questions.actions.create')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <QuestionsTableToolbar
          search={searchInput}
          onSearch={setSearchInput}
          module={filters.values.module}
          onModule={(value) => filters.setValues({ module: value, page: 1 })}
          specialty={filters.values.specialty}
          onSpecialty={(value) => filters.setValues({ specialty: value, page: 1 })}
          status={filters.values.status}
          onStatus={(value) => filters.setValues({ status: value, page: 1 })}
          source={filters.values.source}
          onSource={(value) => filters.setValues({ source: value, page: 1 })}
          specialtyOptions={specialtyOptions}
        />

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium" sx={{ minWidth: 1080 }}>
              <TableHeadCustom
                order={order}
                orderBy={orderBy}
                headLabel={headLabel}
                onSort={handleSort}
              />
              <TableBody>
                {isLoading && <QuestionsTableSkeleton rows={list.rowsPerPage} />}

                {!isLoading &&
                  rows.map((row) => (
                    <QuestionTableRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                      onEdit={handleOpenEdit}
                      onApprove={handleApprove}
                      onDelete={setDeleting}
                    />
                  ))}

                <TableNoData notFound={notFound} title={tx('questions.empty')} />
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

      <QuestionUpsertDialog
        open={upsertDialog.value}
        onClose={upsertDialog.onFalse}
        question={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx('questions.dialogs.delete.title')}
        content={tx('questions.dialogs.delete.content')}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
          >
            {tx('questions.dialogs.delete.confirm')}
          </Button>
        }
      />
    </Container>
  );
}
