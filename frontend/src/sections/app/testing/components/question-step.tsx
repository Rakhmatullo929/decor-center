import { useCallback, useEffect, useRef, useState } from 'react';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
// framer-motion
import { AnimatePresence, m } from 'framer-motion';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import Iconify from 'src/components/iconify';
//
import type { TestModule, TestQuestion } from '../api/types';

// ----------------------------------------------------------------------

function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

type Props = {
  questions: TestQuestion[];
  module: TestModule;
  answers: Partial<Record<number, number>>;
  onAnswer: (questionId: number, option: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

// Bar bounce — no colors, only scaleY
const barBounce = keyframes`
  0%, 100% { transform: scaleY(0.15); }
  50%       { transform: scaleY(1); }
`;

const questionVariants = {
  enter:  (dir: number) => ({ opacity: 0, x: dir * 32 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:   (dir: number) => ({ opacity: 0, x: dir * -32, transition: { duration: 0.2 } }),
};

const BAR_COUNT = 16;

// ----------------------------------------------------------------------

export default function QuestionStep({
  questions,
  module,
  answers,
  onAnswer,
  onSubmit,
  isSubmitting,
}: Props) {
  const { tx, currentLang } = useLocales();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const p       = theme.palette.primary.main;
  const pLight  = theme.palette.primary.light;
  const pDark   = theme.palette.primary.dark;
  const sec     = theme.palette.secondary.main;

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const question = questions[index];
  const total    = questions.length;
  const isLast   = index === total - 1;
  const selected = question ? answers[question.id] : undefined;

  // Stop any in-flight playback (server audio or Web Speech).
  const stopSpeak = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (isSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Browser Web Speech fallback (used when no server audio exists). The kiosk
  // OS rarely has an Uzbek voice, so this is best-effort only (SRS §12.2).
  const speakWebSpeech = useCallback(() => {
    if (!isSpeechSupported() || !question) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.text);
    utterance.lang = currentLang.value === 'ru' ? 'ru-RU' : 'uz-UZ';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [currentLang.value, question]);

  // Prefer pre-generated server audio (SRS §5.2.6); fall back to Web Speech.
  const speak = useCallback(() => {
    if (!question) return;
    stopSpeak();
    if (question.audioUrl) {
      const audio = new Audio(question.audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.play().then(() => setIsSpeaking(true)).catch(() => speakWebSpeech());
      return;
    }
    speakWebSpeech();
  }, [question, stopSpeak, speakWebSpeech]);

  // Auto-read each specialty question as it appears; stop on change/unmount.
  useEffect(() => {
    if (module === 'specialty') speak();
    return () => stopSpeak();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  if (!question) return null;

  // Voice is specialty-only: server audio when present, else Web Speech (SRS §5.2.6).
  const showVoice = module === 'specialty' && (Boolean(question.audioUrl) || isSpeechSupported());

  const handleNext = () => {
    if (selected === undefined) return;
    stopSpeak();
    if (isLast) { onSubmit(); return; }
    setDirection(1);
    setIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    stopSpeak();
    setDirection(-1);
    setIndex((prev) => prev - 1);
  };

  return (
    <Stack spacing={4} sx={{ maxWidth: 740, mx: 'auto', width: 1 }}>

      {/* ── Progress ──────────────────────────────────────────────── */}
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                px: 1.5,
                py: 0.4,
                borderRadius: 1,
                bgcolor: alpha(p, isDark ? 0.14 : 0.1),
                border: '1px solid',
                borderColor: alpha(p, 0.3),
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: p, letterSpacing: 1.5, lineHeight: 1 }}>
                {index + 1} / {total}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {tx('testing.questions.progress', { current: index + 1, total })}
            </Typography>
          </Stack>

          {/* Keyboard shortcut hint */}
          <Typography sx={{ fontSize: 10, color: alpha(theme.palette.text.secondary, 0.4), fontFamily: 'monospace', letterSpacing: 1 }}>
            ENTER — далее
          </Typography>
        </Stack>

        {/* Segmented progress bar */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {Array.from({ length: total }, (_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                transition: 'background-color 0.35s ease',
                bgcolor: (() => {
                  if (i < index) return alpha(p, 0.5);
                  if (i === index) return p;
                  return alpha(p, isDark ? 0.1 : 0.08);
                })(),
                boxShadow: i === index ? `0 0 8px ${alpha(p, 0.5)}` : 'none',
              }}
            />
          ))}
        </Box>
      </Stack>

      {/* ── Voice widget ──────────────────────────────────────────── */}
      {showVoice && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2.5,
            py: 1.75,
            borderRadius: 2,
            bgcolor: isSpeaking
              ? alpha(p, isDark ? 0.1 : 0.06)
              : alpha(theme.palette.text.primary, isDark ? 0.04 : 0.03),
            border: '1px solid',
            borderColor: isSpeaking ? alpha(p, 0.3) : alpha(theme.palette.divider, 0.6),
            transition: 'all 0.3s ease',
          }}
        >
          {/* Replay button — always re-reads the current question */}
          <IconButton
            size="small"
            aria-label={tx('testing.questions.replay')}
            onClick={speak}
            sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              bgcolor: isSpeaking ? alpha(p, 0.15) : alpha(p, 0.08),
              border: '1px solid',
              borderColor: isSpeaking ? alpha(p, 0.4) : alpha(p, 0.18),
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: alpha(p, 0.2) },
            }}
          >
            <Iconify
              icon={isSpeaking ? 'solar:stop-bold' : 'solar:play-bold'}
              sx={{ color: p, width: 16 }}
            />
          </IconButton>

          {/* Equalizer bars */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '3px',
              height: 28,
              flexShrink: 0,
            }}
          >
            {Array.from({ length: BAR_COUNT }, (_, i) => {
              const duration = 0.45 + (i % 5) * 0.1;
              const delay    = i * 0.055;
              const minH     = 3 + (i % 3);
              return (
                <Box
                  key={i}
                  sx={{
                    width: 3,
                    height: 28,
                    borderRadius: '2px 2px 1px 1px',
                    bgcolor: (() => {
                      if (i % 3 === 0) return p;
                      if (i % 3 === 1) return pLight;
                      return sec;
                    })(),
                    transformOrigin: 'bottom center',
                    transform: `scaleY(${minH / 28})`,
                    transition: 'background-color 0.3s ease',
                    ...(isSpeaking && {
                      animation: `${barBounce} ${duration}s ease-in-out ${delay}s infinite`,
                    }),
                  }}
                />
              );
            })}
          </Box>

          {/* Label */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: isSpeaking ? p : theme.palette.text.secondary,
                transition: 'color 0.3s ease',
                letterSpacing: 0.2,
              }}
            >
              {isSpeaking ? 'ИИ озвучивает вопрос...' : 'Нажмите для прослушивания'}
            </Typography>
            {module !== 'specialty' && (
              <Typography sx={{ fontSize: 10, color: alpha(theme.palette.text.secondary, 0.5), mt: 0.25 }}>
                Голосовое сопровождение
              </Typography>
            )}
          </Box>

          {/* Module badge */}
          {isSpeaking && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: theme.palette.success.main,
                  boxShadow: `0 0 6px ${theme.palette.success.main}`,
                  animation: `${barBounce} 1s ease-in-out infinite`,
                }}
              />
              <Typography sx={{ fontSize: 10, color: theme.palette.success.main, fontFamily: 'monospace', letterSpacing: 1 }}>
                LIVE
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ── Question text ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait" custom={direction}>
        <m.div
          key={question.id}
          custom={direction}
          variants={questionVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              lineHeight: 1.45,
              letterSpacing: -0.3,
              color: theme.palette.text.primary,
            }}
          >
            {question.text}
          </Typography>
        </m.div>
      </AnimatePresence>

      {/* ── Answer options ────────────────────────────────────────── */}
      <AnimatePresence mode="wait" custom={direction}>
        <m.div
          key={`opts-${question.id}`}
          custom={direction}
          variants={questionVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <Stack spacing={1.5}>
            {question.options.map((option, optIdx) => {
              const isSelected = selected === optIdx;
              return (
                <m.div
                  key={optIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: optIdx * 0.06, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Box
                    onClick={() => onAnswer(question.id, optIdx)}
                    sx={{
                      px: 2.5,
                      py: 2,
                      borderRadius: 2,
                      border: '1.5px solid',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      transition: 'all 0.18s ease',
                      borderColor: isSelected ? p : alpha(theme.palette.divider, isDark ? 0.5 : 0.8),
                      bgcolor: isSelected
                        ? alpha(p, isDark ? 0.12 : 0.07)
                        : 'background.paper',
                      boxShadow: isSelected
                        ? `0 0 0 1px ${alpha(p, 0.3)}, 0 4px 16px ${alpha(p, 0.12)}`
                        : 'none',
                      '&:hover': {
                        borderColor: alpha(p, 0.6),
                        bgcolor: isSelected
                          ? alpha(p, isDark ? 0.15 : 0.09)
                          : alpha(p, isDark ? 0.05 : 0.03),
                      },
                    }}
                  >
                    {/* Letter badge */}
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1.5,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.18s ease',
                        bgcolor: isSelected ? p : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
                        border: '1px solid',
                        borderColor: isSelected ? p : alpha(theme.palette.divider, 0.5),
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: 13,
                          lineHeight: 1,
                          color: isSelected ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                          transition: 'color 0.18s ease',
                          fontFamily: 'monospace',
                        }}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </Typography>
                    </Box>

                    <Typography
                      sx={{
                        flex: 1,
                        fontWeight: isSelected ? 600 : 400,
                        fontSize: { xs: 14, md: 15 },
                        color: isSelected ? theme.palette.text.primary : alpha(theme.palette.text.primary, 0.8),
                        transition: 'all 0.18s ease',
                        lineHeight: 1.4,
                      }}
                    >
                      {option}
                    </Typography>

                    {isSelected && (
                      <Iconify
                        icon="solar:check-circle-bold"
                        sx={{ color: p, width: 20, flexShrink: 0, ml: 'auto' }}
                      />
                    )}
                  </Box>
                </m.div>
              );
            })}
          </Stack>
        </m.div>
      </AnimatePresence>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          variant="text"
          color="inherit"
          disabled={index === 0}
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          onClick={handleBack}
          sx={{ color: 'text.secondary' }}
        >
          {tx('common.actions.back')}
        </Button>

        <LoadingButton
          variant="contained"
          size="large"
          loading={isSubmitting}
          disabled={selected === undefined}
          endIcon={!isLast ? <Iconify icon="eva:arrow-ios-forward-fill" /> : undefined}
          onClick={handleNext}
          sx={{
            px: 4,
            background: `linear-gradient(135deg, ${p} 0%, ${sec} 100%)`,
            boxShadow: `0 4px 16px ${alpha(p, 0.35)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${pDark} 0%, ${theme.palette.secondary.dark} 100%)`,
              boxShadow: `0 6px 24px ${alpha(p, 0.5)}`,
            },
            '&.Mui-disabled': { opacity: 0.4 },
          }}
        >
          {tx(isLast ? 'common.actions.submit' : 'common.actions.next')}
        </LoadingButton>
      </Stack>
    </Stack>
  );
}
