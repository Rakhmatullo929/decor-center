import { useEffect, useRef, useState } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import useLocales from 'src/locales/use-locales';
import uuidv4 from 'src/utils/uuidv4';
import { useCheckPermission } from 'src/auth/hooks';

import type { LocalizedText, Question, QuestionBlock, QuestionType } from '../../api/types';
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
} from '../../api/use-surveys-api';
import { QUESTION_TYPE_META, defaultOptionText, defaultSettingsFor } from '../utils/question-type-meta';

export type DragData =
  | { type: 'block' }
  | { type: 'question'; blockId: number }
  | { type: 'blockdrop'; blockId: number };

export type ActiveDrag =
  | { kind: 'block'; block: QuestionBlock; blockIndex: number }
  | { kind: 'question'; question: Question };

/**
 * All builder state, mutations and drag&drop handlers, shared by the blocks-list
 * page and the per-block questions page — both operate on the same `Test` tree
 * (a single test fetch already includes every block and question), so splitting
 * the pages doesn't need splitting this logic: each page just renders a subset of
 * what this hook returns and only triggers the handlers relevant to its own drags.
 */
export function useSurveyBuilder(testId: number) {
  const { tx, t } = useLocales();
  const { canWritePage } = useCheckPermission();
  const canWrite = canWritePage('tests');

  const testQuery = useTestQuery(testId);

  const [blocks, setBlocksState] = useState<QuestionBlock[]>([]);
  const blocksRef = useRef<QuestionBlock[]>([]);
  const loadedTestId = useRef<number | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

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

  const handleDeleteBlock = (blockId: number, onSuccess?: () => void) => {
    deleteBlockMutation.mutate(blockId, {
      onSuccess: () => {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        onSuccess?.();
      },
    });
  };

  const handleBlockTitleChange = (blockId: number, title: LocalizedText) => {
    const snapshot = blocksRef.current;
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, title } : b)));
    scheduleSave(`block-${blockId}`, () => {
      updateBlockMutation.mutate(
        { id: blockId, payload: { title } },
        { onError: () => setBlocks(snapshot) }
      );
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
    const snapshot = blocksRef.current;
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : { ...b, questions: (b.questions ?? []).map((q) => (q.id === questionId ? { ...q, ...patch } : q)) }
      )
    );
    scheduleSave(`question-${questionId}`, () => {
      // Look up the question by id across all blocks (not the `blockId` captured at
      // schedule time) — it may have been dragged/moved into a different block before
      // this debounced save fires, and saving against the stale block would silently no-op.
      const block = blocksRef.current.find((b) => (b.questions ?? []).some((q) => q.id === questionId));
      const question = block?.questions?.find((q) => q.id === questionId);
      if (!block || !question) return;
      updateQuestionMutation.mutate(
        {
          id: questionId,
          payload: {
            block: block.id,
            type: question.type,
            order: question.order,
            text: question.text,
            options: question.options,
            settings: question.settings,
            isRequired: question.isRequired,
            isMindDive: question.isMindDive,
          },
        },
        { onError: () => setBlocks(snapshot) }
      );
    });
  };

  const handleMoveQuestionToBlock = (sourceBlockId: number, questionId: number, targetBlockId: number) => {
    if (sourceBlockId === targetBlockId) return;
    const snapshot = blocksRef.current;
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

      source.questions = source.questions.map((q, index) => ({ ...q, order: index }));
      target.questions = target.questions.map((q, index) => ({ ...q, order: index }));

      moveQuestionMutation.mutate(
        {
          question: questionId,
          targetBlock: targetBlockId,
          order: target.questions.map((q) => q.id),
        },
        { onError: () => setBlocks(snapshot) }
      );
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
      const blockIndex = blocksRef.current.findIndex((b) => `block-${b.id}` === event.active.id);
      if (blockIndex !== -1) {
        setActiveDrag({ kind: 'block', block: blocksRef.current[blockIndex], blockIndex });
      }
    } else if (data?.type === 'question') {
      const question = blocksRef.current.flatMap((b) => b.questions ?? []).find((q) => `question-${q.id}` === event.active.id);
      if (question) setActiveDrag({ kind: 'question', question });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    if (activeData?.type === 'block') {
      // `over` may be the target block itself, or (on the combined page layout)
      // one of its nested questions/dropzone — resolve to the owning block id.
      let targetBlockId: number | undefined;
      if (overData?.type === 'block') targetBlockId = Number(String(over.id).replace('block-', ''));
      else if (overData?.type === 'question') targetBlockId = overData.blockId;
      else if (overData?.type === 'blockdrop') targetBlockId = overData.blockId;
      if (targetBlockId === undefined) return;

      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => `block-${b.id}` === active.id);
        const newIndex = prev.findIndex((b) => b.id === targetBlockId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        const reordered = arrayMove(prev, oldIndex, newIndex).map((b, index) => ({ ...b, order: index }));
        reorderBlocksMutation.mutate(
          { test: testId, order: reordered.map((b) => b.id) },
          { onError: () => setBlocks(prev) }
        );
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

        // Resolve the drop target's index against the pre-drag array — looking it up
        // after removing the dragged item would shift indices for anything past it.
        let targetIndex = targetBlock.questions.length;
        if (overData?.type === 'question') {
          const overQuestionId = Number(String(over.id).replace('question-', ''));
          const idx = targetBlock.questions.findIndex((q) => q.id === overQuestionId);
          if (idx !== -1) targetIndex = idx;
        }

        if (sourceBlock === targetBlock) {
          // Same-block reorder: `arrayMove` (also used for block reordering above)
          // removes at `movingIndex` and re-inserts at the ORIGINAL `targetIndex` —
          // no manual "-1" compensation needed, and critically, this is the only
          // way to correctly land on the very last slot (a hand-rolled splice that
          // decrements the target index can never place the dragged item after the
          // last row — it always lands one slot short of the end).
          if (targetIndex === movingIndex) return prev;
          sourceBlock.questions = arrayMove(sourceBlock.questions, movingIndex, targetIndex).map(
            (q, index) => ({ ...q, order: index })
          );
        } else {
          const [moving] = sourceBlock.questions.splice(movingIndex, 1);
          moving.block = targetBlock.id;
          targetBlock.questions.splice(targetIndex, 0, moving);

          sourceBlock.questions = sourceBlock.questions.map((q, index) => ({ ...q, order: index }));
          targetBlock.questions = targetBlock.questions.map((q, index) => ({ ...q, order: index }));
        }

        const targetOrder = targetBlock.questions.map((q) => q.id);
        if (sourceBlockId === targetBlock.id) {
          reorderQuestionsMutation.mutate(
            { block: targetBlock.id, order: targetOrder },
            { onError: () => setBlocks(prev) }
          );
        } else {
          moveQuestionMutation.mutate(
            { question: activeQuestionId, targetBlock: targetBlock.id, order: targetOrder },
            { onError: () => setBlocks(prev) }
          );
        }
        return next;
      });
    }
  };

  return {
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
    handleAddBlock,
    handleDeleteBlock,
    handleBlockTitleChange,
    handleAddQuestion,
    handleDeleteQuestion,
    handleDuplicateQuestion,
    handleQuestionChange,
    handleMoveQuestionToBlock,
  };
}
