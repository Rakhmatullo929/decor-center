import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import uuidv4 from 'src/utils/uuidv4';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { paths } from 'src/routes/paths';
import { useCheckPermission } from 'src/auth/hooks';

import type { LocalizedText, Question, QuestionBlock, QuestionType } from '../api/types';
import {
  useCreateQuestionBlockMutation,
  useCreateQuestionMutation,
  useDeleteQuestionBlockMutation,
  useDeleteQuestionMutation,
  useMoveQuestionMutation,
  useReorderQuestionBlocksMutation,
  useReorderQuestionsMutation,
  useTestQuery,
  useUpdateQuestionBlockMutation,
  useUpdateQuestionMutation,
} from '../api/use-surveys-api';
import SortableBlockCard from './components/sortable-block-card';
import { QUESTION_TYPE_META, defaultOptionText, defaultSettingsFor } from './utils/question-type-meta';

type DragData = { type: 'block' } | { type: 'question'; blockId: number } | { type: 'blockdrop'; blockId: number };

function blockLabel(block: QuestionBlock, tx: (key: string) => string) {
  return block.title.ru || block.title.uz || tx('surveys.builder.untitledBlock');
}

export default function SurveyBuilderView() {
  const { tx, t } = useLocales();
  const settings = useSettingsContext();
  const { canWritePage } = useCheckPermission();
  const canWrite = canWritePage('tests');

  const { testId: testIdParam } = useParams();
  const testId = Number(testIdParam);

  const testQuery = useTestQuery(testId);

  const [blocks, setBlocksState] = useState<QuestionBlock[]>([]);
  const blocksRef = useRef<QuestionBlock[]>([]);
  const loadedTestId = useRef<number | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ kind: 'block' | 'question'; label: string } | null>(null);

  function setBlocks(updater: QuestionBlock[] | ((prev: QuestionBlock[]) => QuestionBlock[])) {
    setBlocksState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: QuestionBlock[]) => QuestionBlock[])(prev) : updater;
      blocksRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    if (testQuery.data && loadedTestId.current !== testId) {
      setBlocks(testQuery.data.blocks ?? []);
      loadedTestId.current = testId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testQuery.data, testId]);

  const saveTimers = useRef<Record<string, number>>({});
  useEffect(
    () => () => {
      Object.values(saveTimers.current).forEach((timer) => window.clearTimeout(timer));
    },
    []
  );
  function scheduleSave(key: string, fn: () => void, delay = 600) {
    window.clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = window.setTimeout(fn, delay);
  }

  const createBlockMutation = useCreateQuestionBlockMutation();
  const updateBlockMutation = useUpdateQuestionBlockMutation();
  const deleteBlockMutation = useDeleteQuestionBlockMutation();
  const reorderBlocksMutation = useReorderQuestionBlocksMutation();
  const createQuestionMutation = useCreateQuestionMutation();
  const updateQuestionMutation = useUpdateQuestionMutation();
  const deleteQuestionMutation = useDeleteQuestionMutation();
  const reorderQuestionsMutation = useReorderQuestionsMutation();
  const moveQuestionMutation = useMoveQuestionMutation();

  const handleAddBlock = () => {
    const order = blocksRef.current.length;
    createBlockMutation.mutate(
      { test: testId, order, title: { uz: '', ru: '' } },
      { onSuccess: (block) => setBlocks((prev) => [...prev, { ...block, questions: [] }]) }
    );
  };

  const handleDeleteBlock = (blockId: number) => {
    deleteBlockMutation.mutate(blockId, {
      onSuccess: () => setBlocks((prev) => prev.filter((b) => b.id !== blockId)),
    });
  };

  const handleBlockTitleChange = (blockId: number, title: LocalizedText) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, title } : b)));
    scheduleSave(`block-${blockId}`, () => {
      updateBlockMutation.mutate({ id: blockId, payload: { title } });
    });
  };

  const handleAddQuestion = (blockId: number, type: QuestionType) => {
    const block = blocksRef.current.find((b) => b.id === blockId);
    const order = block?.questions?.length ?? 0;
    const { hasOptions } = QUESTION_TYPE_META[type];
    createQuestionMutation.mutate(
      {
        block: blockId,
        type,
        order,
        text: { uz: '', ru: '' },
        // The backend rejects options with blank text in both languages, so a new
        // single/multiple question can't start with empty option placeholders.
        options: hasOptions
          ? [
              { id: uuidv4(), text: defaultOptionText(t, 0) },
              { id: uuidv4(), text: defaultOptionText(t, 1) },
            ]
          : [],
        settings: defaultSettingsFor(type),
      },
      {
        onSuccess: (question) => {
          setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, questions: [...(b.questions ?? []), question] } : b))
          );
          setExpandedQuestionId(question.id);
        },
      }
    );
  };

  const handleDeleteQuestion = (blockId: number, questionId: number) => {
    deleteQuestionMutation.mutate(questionId, {
      onSuccess: () =>
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === blockId ? { ...b, questions: (b.questions ?? []).filter((q) => q.id !== questionId) } : b
          )
        ),
    });
  };

  const handleDuplicateQuestion = (blockId: number, questionId: number) => {
    const block = blocksRef.current.find((b) => b.id === blockId);
    const question = block?.questions?.find((q) => q.id === questionId);
    if (!question) return;
    createQuestionMutation.mutate(
      {
        block: blockId,
        type: question.type,
        order: block?.questions?.length ?? 0,
        text: question.text,
        options: question.options.map((o) => ({ id: uuidv4(), text: o.text })),
        settings: question.settings,
        isRequired: question.isRequired,
        isMindDive: question.isMindDive,
      },
      {
        onSuccess: (created) =>
          setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, questions: [...(b.questions ?? []), created] } : b))
          ),
      }
    );
  };

  const handleQuestionChange = (blockId: number, questionId: number, patch: Partial<Question>) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : { ...b, questions: (b.questions ?? []).map((q) => (q.id === questionId ? { ...q, ...patch } : q)) }
      )
    );
    scheduleSave(`question-${questionId}`, () => {
      const block = blocksRef.current.find((b) => b.id === blockId);
      const question = block?.questions?.find((q) => q.id === questionId);
      if (!question) return;
      updateQuestionMutation.mutate({
        id: questionId,
        payload: {
          block: blockId,
          type: question.type,
          order: question.order,
          text: question.text,
          options: question.options,
          settings: question.settings,
          isRequired: question.isRequired,
          isMindDive: question.isMindDive,
        },
      });
    });
  };

  const handleMoveQuestionToBlock = (sourceBlockId: number, questionId: number, targetBlockId: number) => {
    if (sourceBlockId === targetBlockId) return;
    setBlocks((prev) => {
      const next = prev.map((b) => ({ ...b, questions: [...(b.questions ?? [])] }));
      const source = next.find((b) => b.id === sourceBlockId);
      const target = next.find((b) => b.id === targetBlockId);
      if (!source || !target) return prev;
      const idx = source.questions.findIndex((q) => q.id === questionId);
      if (idx === -1) return prev;
      const [moving] = source.questions.splice(idx, 1);
      moving.block = targetBlockId;
      target.questions.push(moving);
      moveQuestionMutation.mutate({
        question: questionId,
        targetBlock: targetBlockId,
        order: target.questions.map((q) => q.id),
      });
      return next;
    });
    setExpandedQuestionId(questionId);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data?.type === 'block') {
      const block = blocksRef.current.find((b) => `block-${b.id}` === event.active.id);
      if (block) setActiveDrag({ kind: 'block', label: blockLabel(block, tx) });
    } else if (data?.type === 'question') {
      const question = blocksRef.current.flatMap((b) => b.questions ?? []).find((q) => `question-${q.id}` === event.active.id);
      if (question) setActiveDrag({ kind: 'question', label: question.text.ru || question.text.uz || '' });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    if (activeData?.type === 'block') {
      // `over` may be the target block itself, or one of its nested questions/dropzone
      // when the pointer ends up hovering the block's question list — resolve to the
      // owning block id in every case.
      let targetBlockId: number | undefined;
      if (overData?.type === 'block') targetBlockId = Number(String(over.id).replace('block-', ''));
      else if (overData?.type === 'question') targetBlockId = overData.blockId;
      else if (overData?.type === 'blockdrop') targetBlockId = overData.blockId;
      if (targetBlockId === undefined) return;

      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => `block-${b.id}` === active.id);
        const newIndex = prev.findIndex((b) => b.id === targetBlockId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        const reordered = arrayMove(prev, oldIndex, newIndex);
        reorderBlocksMutation.mutate({ test: testId, order: reordered.map((b) => b.id) });
        return reordered;
      });
      return;
    }

    if (activeData?.type === 'question') {
      const sourceBlockId = activeData.blockId;
      let targetBlockId: number | undefined;
      if (overData?.type === 'question') targetBlockId = overData.blockId;
      else if (overData?.type === 'blockdrop') targetBlockId = overData.blockId;
      else if (overData?.type === 'block') targetBlockId = Number(String(over.id).replace('block-', ''));
      if (targetBlockId === undefined) return;

      const activeQuestionId = Number(String(active.id).replace('question-', ''));

      setBlocks((prev) => {
        const next = prev.map((b) => ({ ...b, questions: [...(b.questions ?? [])] }));
        const sourceBlock = next.find((b) => b.id === sourceBlockId);
        const targetBlock = next.find((b) => b.id === targetBlockId);
        if (!sourceBlock || !targetBlock) return prev;
        const movingIndex = sourceBlock.questions.findIndex((q) => q.id === activeQuestionId);
        if (movingIndex === -1) return prev;
        if (sourceBlock === targetBlock && overData?.type !== 'question') return prev;

        const [moving] = sourceBlock.questions.splice(movingIndex, 1);
        moving.block = targetBlock.id;

        let insertIndex = targetBlock.questions.length;
        if (overData?.type === 'question') {
          const overQuestionId = Number(String(over.id).replace('question-', ''));
          const idx = targetBlock.questions.findIndex((q) => q.id === overQuestionId);
          if (idx !== -1) insertIndex = idx;
        }
        targetBlock.questions.splice(insertIndex, 0, moving);

        const targetOrder = targetBlock.questions.map((q) => q.id);
        if (sourceBlockId === targetBlock.id) {
          reorderQuestionsMutation.mutate({ block: targetBlock.id, order: targetOrder });
        } else {
          moveQuestionMutation.mutate({ question: activeQuestionId, targetBlock: targetBlock.id, order: targetOrder });
        }
        return next;
      });
    }
  };

  if (testQuery.isLoading) {
    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <Stack alignItems="center" sx={{ py: 10 }}>
          <CircularProgress />
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.builder.title')}
        links={[
          { name: tx('surveys.tests.title'), href: paths.app.surveys.tests },
          { name: testQuery.data?.title ?? '', href: paths.app.surveys.blocks(testId) },
        ]}
        action={
          canWrite && (
            <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleAddBlock}>
              {tx('surveys.builder.actions.addBlock')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {blocks.length === 0 ? (
        <Paper variant="outlined">
          <EmptyContent filled title={tx('surveys.builder.emptyBlocks')} sx={{ py: 10 }} />
        </Paper>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blocks.map((b) => `block-${b.id}`)} strategy={verticalListSortingStrategy}>
            <Stack spacing={2}>
              {blocks.map((block) => (
                <SortableBlockCard
                  key={block.id}
                  block={block}
                  blockOptionsForMove={blocks
                    .filter((b) => b.id !== block.id)
                    .map((b) => ({ id: b.id, label: blockLabel(b, tx) }))}
                  expandedQuestionId={expandedQuestionId}
                  onToggleExpandQuestion={(questionId) =>
                    setExpandedQuestionId((prev) => (prev === questionId ? null : questionId))
                  }
                  onTitleChange={(title) => handleBlockTitleChange(block.id, title)}
                  onDeleteBlock={() => handleDeleteBlock(block.id)}
                  onAddQuestion={(type) => handleAddQuestion(block.id, type)}
                  onQuestionChange={(questionId, patch) => handleQuestionChange(block.id, questionId, patch)}
                  onDeleteQuestion={(questionId) => handleDeleteQuestion(block.id, questionId)}
                  onDuplicateQuestion={(questionId) => handleDuplicateQuestion(block.id, questionId)}
                  onMoveQuestionToBlock={(questionId, targetBlockId) =>
                    handleMoveQuestionToBlock(block.id, questionId, targetBlockId)
                  }
                />
              ))}
            </Stack>
          </SortableContext>
          <DragOverlay>
            {activeDrag && (
              <Paper sx={{ p: 1.5, boxShadow: (theme) => theme.customShadows?.z20 }}>
                <Typography variant="body2" noWrap sx={{ maxWidth: 320 }}>
                  {activeDrag.label || tx('surveys.builder.untitledQuestion')}
                </Typography>
              </Paper>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </Container>
  );
}
