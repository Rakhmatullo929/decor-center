import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { ConfirmDialog } from 'src/components/custom-dialog';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { useBoolean } from 'src/hooks/use-boolean';
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hook';

import AddQuestionMenu from './components/add-question-menu';
import BilingualTextField from './components/bilingual-text-field';
import BuilderSkeleton from './components/builder-skeleton';
import QuestionRowPreview from './components/question-row-preview';
import SortableQuestionRow from './components/sortable-question-row';
import { useSurveyBuilder } from './hooks/use-survey-builder';
import { blockLabel } from './utils/block-label';

export default function SurveyBlockQuestionsView() {
  const router = useRouter();
  const settings = useSettingsContext();
  const deleteConfirm = useBoolean();

  const { testId: testIdParam, blockId: blockIdParam } = useParams();
  const testId = Number(testIdParam);
  const blockId = Number(blockIdParam);

  const {
    tx,
    canWrite,
    testQuery,
    blocks,
    expandedQuestionId,
    setExpandedQuestionId,
    activeDrag,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDeleteBlock,
    handleBlockTitleChange,
    handleAddQuestion,
    handleDeleteQuestion,
    handleDuplicateQuestion,
    handleQuestionChange,
    handleMoveQuestionToBlock,
  } = useSurveyBuilder(testId);

  // Authoritative check against the fetch result (not the local `blocks` copy,
  // which is populated by an effect a tick after `testQuery.data` arrives) so this
  // never fires a redirect from a render that just hasn't caught up yet.
  const blockExists = !!testQuery.data?.blocks?.some((b) => b.id === blockId);
  useEffect(() => {
    if (!testQuery.isLoading && testQuery.data && !blockExists) {
      router.replace(paths.app.surveys.blocks(testId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testQuery.isLoading, testQuery.data, blockExists, testId]);

  const block = blocks.find((b) => b.id === blockId);
  if (testQuery.isLoading || !block) {
    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <BuilderSkeleton />
      </Container>
    );
  }

  const questions = block.questions ?? [];
  const blockOptionsForMove = blocks
    .filter((b) => b.id !== block.id)
    .map((b) => ({ id: b.id, label: blockLabel(b, tx) }));

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.builder.questionsTitle')}
        links={[
          // No standalone tests-list screen to link back to — surveys are
          // administered on the backend, so this crumb is a label, not a link.
          { name: tx('surveys.tests.title') },
          { name: testQuery.data?.title ?? '', href: paths.app.surveys.blocks(testId) },
          { name: blockLabel(block, tx) },
        ]}
        action={
          <Button
            variant="outlined"
            startIcon={<Iconify icon="mingcute:left-line" />}
            onClick={() => router.push(paths.app.surveys.blocks(testId))}
          >
            {tx('surveys.builder.actions.backToBlocks')}
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flexGrow: 1 }}>
            <BilingualTextField
              label={tx('surveys.builder.form.blockTitle')}
              value={block.title}
              onChange={(title) => handleBlockTitleChange(block.id, title)}
              showFlagIcons
            />
          </Box>
          <Tooltip title={tx('surveys.builder.dialogs.deleteBlock.title')}>
            <IconButton color="error" onClick={deleteConfirm.onTrue}>
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Card>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {tx('surveys.builder.questionCount', { count: questions.length })}
        </Typography>
        {canWrite && <AddQuestionMenu onSelect={(type) => handleAddQuestion(block.id, type)} />}
      </Stack>

      {questions.length === 0 ? (
        <Paper variant="outlined">
          <EmptyContent filled title={tx('surveys.builder.emptyQuestions')} sx={{ py: 10 }} />
        </Paper>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={questions.map((q) => `question-${q.id}`)} strategy={verticalListSortingStrategy}>
            <Stack spacing={1.5}>
              {questions.map((question, questionIndex) => (
                <SortableQuestionRow
                  key={question.id}
                  question={question}
                  questionIndex={questionIndex}
                  blockId={block.id}
                  blockOptions={blockOptionsForMove}
                  expanded={expandedQuestionId === question.id}
                  onToggleExpand={() =>
                    setExpandedQuestionId((prev) => (prev === question.id ? null : question.id))
                  }
                  onChange={(patch) => handleQuestionChange(block.id, question.id, patch)}
                  onDelete={() => handleDeleteQuestion(block.id, question.id)}
                  onDuplicate={() => handleDuplicateQuestion(block.id, question.id)}
                  onMoveToBlock={(targetBlockId) => handleMoveQuestionToBlock(block.id, question.id, targetBlockId)}
                />
              ))}
            </Stack>
          </SortableContext>
          <DragOverlay>
            {activeDrag?.kind === 'question' && <QuestionRowPreview question={activeDrag.question} />}
          </DragOverlay>
        </DndContext>
      )}

      <ConfirmDialog
        open={deleteConfirm.value}
        onClose={deleteConfirm.onFalse}
        title={tx('surveys.builder.dialogs.deleteBlock.title')}
        content={tx('surveys.builder.dialogs.deleteBlock.content')}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              deleteConfirm.onFalse();
              handleDeleteBlock(block.id, () => router.replace(paths.app.surveys.blocks(testId)));
            }}
          >
            {tx('common.actions.delete')}
          </Button>
        }
      />
    </Container>
  );
}
