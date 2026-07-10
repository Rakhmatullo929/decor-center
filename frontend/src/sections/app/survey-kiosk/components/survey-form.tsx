import { useCallback, useMemo, useRef, useState } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import type { AutosaveAnswerPayload, KioskAnswer, SurveyBlock, SurveyQuestion } from '../api/types';
import type { AutosaveStatus } from '../session/use-answer-autosave';
import QuestionCard from './question-card';

type Props = {
  testTitle: string;
  blocks: SurveyBlock[];
  answers: Record<number, KioskAnswer>;
  autosaveStatusByQuestion: Record<number, AutosaveStatus>;
  onAnswer: (item: AutosaveAnswerPayload, opts?: { immediate?: boolean }) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

function isAnswered(question: SurveyQuestion, answer: KioskAnswer | undefined): boolean {
  switch (question.type) {
    case 'section_header':
      return true;
    case 'single':
      return (answer?.selectedOptionIds?.length ?? 0) === 1;
    case 'multiple':
      return (answer?.selectedOptionIds?.length ?? 0) >= 1;
    case 'signature_date':
      try {
        const parsed = JSON.parse(answer?.textValue ?? '');
        return Boolean(parsed.name) && Boolean(parsed.date);
      } catch {
        return false;
      }
    default:
      return Boolean(answer?.textValue?.trim());
  }
}

/** Required, still-unanswered questions in one block (section headers never count). */
function blockRequiredUnanswered(
  block: SurveyBlock,
  answers: Record<number, KioskAnswer>
): SurveyQuestion[] {
  return block.questions.filter(
    (q) => q.isRequired && q.type !== 'section_header' && !isAnswered(q, answers[q.id])
  );
}

function isBlockComplete(block: SurveyBlock, answers: Record<number, KioskAnswer>): boolean {
  return blockRequiredUnanswered(block, answers).length === 0;
}

/** First block with an unanswered required question — where a resumed session should land. */
function firstIncompleteBlockIndex(
  blocks: SurveyBlock[],
  answers: Record<number, KioskAnswer>
): number {
  const idx = blocks.findIndex((b) => !isBlockComplete(b, answers));
  return idx === -1 ? blocks.length - 1 : idx;
}

/**
 * Section-navigated survey: a left rail lists every block with its state (done / current /
 * locked), and the content area shows one block's questions at a time. Advancing is gated on
 * the current block's required questions, so employees only move forward once a section is
 * complete; completed sections stay freely reachable from the rail. Answers autosave on every
 * change, so switching sections never loses input. On narrow screens the rail collapses into a
 * horizontal strip above the questions.
 */
export default function SurveyForm({
  testTitle,
  blocks,
  answers,
  autosaveStatusByQuestion,
  onAnswer,
  onSubmit,
  isSubmitting,
}: Props) {
  const { tx } = useLocales();
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const topRef = useRef<HTMLDivElement | null>(null);
  const [invalidIds, setInvalidIds] = useState<Set<number>>(new Set());

  // Resume where the employee left off; earlier sections stay reachable via the rail. Computed
  // once from the seeded answers so a background refetch never yanks the user to another section.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialStep = useMemo(() => Math.max(firstIncompleteBlockIndex(blocks, answers), 0), []);
  const [activeStep, setActiveStep] = useState(initialStep);
  const [maxReached, setMaxReached] = useState(initialStep);

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setInvalidIds(new Set());
      setActiveStep(index);
      scrollToTop();
    },
    [scrollToTop]
  );

  // Validate the section the user is leaving; on a gap, highlight it and scroll to the first one.
  const validateActiveBlock = useCallback(() => {
    const unanswered = blockRequiredUnanswered(blocks[activeStep], answers);
    if (unanswered.length === 0) {
      setInvalidIds(new Set());
      return true;
    }
    setInvalidIds(new Set(unanswered.map((q) => q.id)));
    cardRefs.current[unanswered[0].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }, [blocks, activeStep, answers]);

  const handleNext = useCallback(() => {
    if (!validateActiveBlock()) return;
    const next = Math.min(activeStep + 1, blocks.length - 1);
    setMaxReached((prev) => Math.max(prev, next));
    goTo(next);
  }, [validateActiveBlock, activeStep, blocks.length, goTo]);

  const handleBack = useCallback(() => {
    goTo(Math.max(activeStep - 1, 0));
  }, [activeStep, goTo]);

  const handleRailClick = useCallback(
    (index: number) => {
      if (index === activeStep) return;
      if (index < activeStep) {
        goTo(index); // going back is always free
        return;
      }
      if (index > maxReached) return; // future sections stay locked until reached
      if (!validateActiveBlock()) return; // forward jumps are still gated
      goTo(index);
    },
    [activeStep, maxReached, validateActiveBlock, goTo]
  );

  const handleSubmit = useCallback(() => {
    if (!validateActiveBlock()) return;
    onSubmit();
  }, [validateActiveBlock, onSubmit]);

  if (blocks.length === 0) {
    return <Typography variant="h4">{testTitle}</Typography>;
  }

  const activeBlock = blocks[activeStep];
  const isLastStep = activeStep === blocks.length - 1;
  const doneCount = blocks.filter((b) => isBlockComplete(b, answers)).length;

  return (
    <Stack ref={topRef} spacing={{ xs: 3, md: 3.5 }}>
      <Typography variant="h4">{testTitle}</Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '244px minmax(0, 1fr)' },
          gap: { xs: 2.5, md: 4 },
          alignItems: 'start',
        }}
      >
        {/* ---- section rail ---- */}
        <Box
          component="nav"
          aria-label={tx('survey.kiosk.form.sections')}
          sx={{
            pr: { md: 3 },
            pb: { xs: 2, md: 0 },
            borderRight: { md: '1px solid' },
            borderBottom: { xs: '1px solid', md: 'none' },
            borderColor: 'divider',
          }}
        >
          <Typography variant="overline" sx={{ display: 'block', color: 'text.disabled' }}>
            {tx('survey.kiosk.form.sections')}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
            {tx('survey.kiosk.form.sectionsProgress', { done: doneCount, total: blocks.length })}
          </Typography>

          <Box
            sx={{
              display: { xs: 'flex', md: 'block' },
              gap: { xs: 1, md: 0 },
              overflowX: { xs: 'auto', md: 'visible' },
              mx: { xs: -0.5, md: 0 },
              px: { xs: 0.5, md: 0 },
              pb: { xs: 0.5, md: 0 },
            }}
          >
            {blocks.map((block, index) => {
              const done = isBlockComplete(block, answers) && index !== activeStep;
              const current = index === activeStep;
              const locked = index > maxReached;
              let chipColor = 'text.secondary';
              if (done) chipColor = 'primary.contrastText';
              else if (current) chipColor = 'primary.main';
              return (
                <ButtonBase
                  key={block.id}
                  disabled={locked}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => handleRailClick(index)}
                  sx={{
                    width: { xs: 'auto', md: 1 },
                    minWidth: { xs: 150, md: 0 },
                    justifyContent: 'flex-start',
                    gap: 1.25,
                    px: 1.25,
                    py: 1,
                    mb: { md: 0.5 },
                    borderRadius: 1.5,
                    textAlign: 'left',
                    color: current ? 'text.primary' : 'text.secondary',
                    fontWeight: current ? 600 : 400,
                    opacity: locked ? 0.5 : 1,
                    bgcolor: current ? (t) => alpha(t.palette.primary.main, 0.08) : 'transparent',
                    transition: (t) => t.transitions.create(['background-color', 'color']),
                    '&:hover': !locked
                      ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }
                      : undefined,
                  }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 1,
                      display: 'grid',
                      placeItems: 'center',
                      typography: 'caption',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      border: '1px solid',
                      borderColor: done || current ? 'primary.main' : 'divider',
                      bgcolor: done ? 'primary.main' : 'transparent',
                      color: chipColor,
                    }}
                  >
                    {done ? <Iconify icon="eva:checkmark-fill" width={16} /> : index + 1}
                  </Box>

                  <Box component="span" sx={{ flexGrow: 1, typography: 'body2', lineHeight: 1.3 }}>
                    {block.title || String(index + 1)}
                  </Box>

                  {locked && (
                    <Iconify
                      icon="eva:lock-fill"
                      width={15}
                      sx={{ flexShrink: 0, color: 'text.disabled' }}
                    />
                  )}
                </ButtonBase>
              );
            })}
          </Box>
        </Box>

        {/* ---- current section ---- */}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'text.disabled' }}>
              {tx('survey.kiosk.form.stepOf', { current: activeStep + 1, total: blocks.length })}
            </Typography>
            {activeBlock.title && (
              <Typography variant="h5" sx={{ mt: 0.5 }}>
                {activeBlock.title}
              </Typography>
            )}
          </Box>

          <Stack spacing={2.5}>
            {activeBlock.questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                answer={answers[question.id]}
                invalid={invalidIds.has(question.id)}
                autosaveStatus={autosaveStatusByQuestion[question.id] ?? 'idle'}
                onAnswer={onAnswer}
                cardRef={(el) => {
                  cardRefs.current[question.id] = el;
                }}
              />
            ))}
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3 }}>
            {activeStep > 0 ? (
              <Button
                variant="outlined"
                size="large"
                startIcon={<Iconify icon="eva:arrow-back-fill" />}
                onClick={handleBack}
              >
                {tx('common.actions.back')}
              </Button>
            ) : (
              <span />
            )}

            {isLastStep ? (
              <LoadingButton
                variant="contained"
                size="large"
                loading={isSubmitting}
                endIcon={<Iconify icon="eva:paper-plane-fill" />}
                onClick={handleSubmit}
              >
                {tx('common.actions.submit')}
              </LoadingButton>
            ) : (
              <Button
                variant="contained"
                size="large"
                endIcon={<Iconify icon="eva:arrow-forward-fill" />}
                onClick={handleNext}
              >
                {tx('common.actions.next')}
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
