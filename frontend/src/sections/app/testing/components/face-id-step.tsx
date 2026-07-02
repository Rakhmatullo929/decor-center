import { useCallback, useEffect, useRef, useState } from 'react';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
// framer-motion
import { AnimatePresence, m } from 'framer-motion';
// hooks
import useLocales from 'src/locales/use-locales';
// routes
import { useRouter } from 'src/routes/hook';
import { paths } from 'src/routes/paths';
// auth
import { useLogoutMutation } from 'src/auth/api';
// utils
import { captureFrame } from 'src/utils/camera';
import { errorReader } from 'src/utils/error-reader';
// components
import Iconify from 'src/components/iconify';
import LanguagePopover from 'src/layouts/_common/language-popover';
//
import type { Employee } from '../../employees/api/types';
import type { StartTestSessionResponse, TestModule } from '../api/types';
import { useIdentifyEmployeeMutation, useStartTestSessionMutation } from '../api/use-testing-api';
import ThreeBg from './three-bg';

// ----------------------------------------------------------------------

type Phase = 'scanning' | 'identified';
type CameraError = 'denied' | 'unavailable';

const MODULES: Array<{ value: TestModule; labelKey: string; icon: string }> = [
  { value: 'specialty',         labelKey: 'common.modules.specialty',        icon: 'solar:diploma-bold-duotone' },
  { value: 'tech_safety',       labelKey: 'common.modules.techSafety',       icon: 'solar:shield-check-bold-duotone' },
  { value: 'industrial_safety', labelKey: 'common.modules.industrialSafety', icon: 'solar:danger-triangle-bold-duotone' },
];

type Props = {
  onStarted: (data: StartTestSessionResponse) => void;
  onBack: () => void;
};

// ── Keyframes ──────────────────────────────────────────────────────────────

const rotateArc = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const rotateArcRev = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
`;

const sweepLine = keyframes`
  0%   { top: 12%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 0.7; }
  100% { top: 88%; opacity: 0; }
`;

const blink = keyframes`
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 1; }
`;

const successPop = keyframes`
  0%   { transform: scale(0.7); opacity: 0; }
  70%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
`;

const ringGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 2px currentColor; }
  50%       { box-shadow: 0 0 20px 4px currentColor; }
`;

const pulseRing = keyframes`
  0%, 100% { opacity: 0.12; transform: scale(1); }
  50%       { opacity: 0.38; transform: scale(1.03); }
`;

// ── Sub-components ──────────────────────────────────────────────────────────

function ModuleSelector({
  value,
  onChange,
  disabled,
}: {
  value: TestModule;
  onChange: (m: TestModule) => void;
  disabled: boolean;
}) {
  const { tx } = useLocales();
  const t = useTheme();
  const p      = t.palette.primary.main;
  const pLight = t.palette.primary.light;
  const { white } = t.palette.common;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        p: 0.5,
        borderRadius: 2,
        bgcolor: alpha(white, 0.05),
        backdropFilter: 'blur(20px)',
        border: '1px solid',
        borderColor: alpha(white, 0.08),
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        transition: 'opacity 0.25s ease',
      }}
    >
      {MODULES.map((mod) => {
        const active = value === mod.value;
        return (
          <Box
            key={mod.value}
            onClick={() => onChange(mod.value)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: { xs: 1.25, md: 1.75 },
              py: 0.75,
              borderRadius: 1.5,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              bgcolor: active ? alpha(p, 0.32) : 'transparent',
              border: '1px solid',
              borderColor: active ? alpha(p, 0.55) : 'transparent',
              boxShadow: active ? `0 0 14px ${alpha(p, 0.28)}` : 'none',
              '&:hover': { bgcolor: active ? alpha(p, 0.38) : alpha(white, 0.06) },
            }}
          >
            <Iconify
              icon={mod.icon}
              sx={{ width: 15, height: 15, color: active ? pLight : alpha(white, 0.35), flexShrink: 0 }}
            />
            <Typography
              sx={{
                fontSize: { xs: 11, md: 12 },
                fontWeight: active ? 600 : 400,
                color: active ? white : alpha(white, 0.45),
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              {tx(mod.labelKey)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function IdentifiedEmployeeBanner({
  employee,
  onRescan,
}: {
  employee: Employee;
  onRescan: () => void;
}) {
  const { tx } = useLocales();
  const t = useTheme();
  const p     = t.palette.primary.main;
  const { white } = t.palette.common;
  const green = t.palette.success.main;

  return (
    <m.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" sx={{ gap: 1.5 }}>
        {/* Verified badge + avatar */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={employee.photo ?? undefined}
            alt={employee.fullName}
            sx={{
              width: 52,
              height: 52,
              fontSize: 20,
              fontWeight: 700,
              bgcolor: alpha(p, 0.2),
              color: p,
              border: '2px solid',
              borderColor: green,
              animation: `${ringGlow} 2.5s ease-in-out infinite`,
            }}
          >
            {employee.fullName.charAt(0).toUpperCase()}
          </Avatar>
          <Box
            sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              bgcolor: green,
              border: `2px solid ${t.palette.grey[900]}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `${successPop} 0.4s ease forwards`,
            }}
          >
            <Iconify icon="solar:check-bold" sx={{ color: white, width: 10 }} />
          </Box>
        </Box>

        {/* Name + specialty */}
        <Stack spacing={0.3}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              sx={{
                fontFamily: 'monospace',
                fontSize: 9,
                letterSpacing: 2,
                color: alpha(green, 0.85),
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              {tx('testing.faceId.identified')}
            </Typography>
            <Box
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                bgcolor: green,
                boxShadow: `0 0 6px ${green}`,
                animation: `${blink} 1.5s ease-in-out infinite`,
              }}
            />
          </Stack>
          <Typography sx={{ color: white, fontWeight: 700, fontSize: { xs: 14, md: 16 }, lineHeight: 1.2 }}>
            {employee.fullName}
          </Typography>
          <Typography sx={{ color: alpha(p, 0.9), fontSize: 12, letterSpacing: 0.5, lineHeight: 1 }}>
            {employee.specialtyName}
          </Typography>
        </Stack>

        {/* Re-scan link */}
        <Button
          size="small"
          onClick={onRescan}
          sx={{
            ml: 'auto',
            color: alpha(white, 0.5),
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: 1,
            textTransform: 'uppercase',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            border: '1px solid',
            borderColor: alpha(white, 0.12),
            '&:hover': { color: white, bgcolor: alpha(white, 0.06) },
          }}
        >
          {tx('testing.faceId.notYou')}
        </Button>
      </Stack>
    </m.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function FaceIdStep({ onStarted, onBack }: Props) {
  const { tx } = useLocales();
  const theme = useTheme();
  const router = useRouter();
  const logoutMutation = useLogoutMutation();

  const p            = theme.palette.primary.main;
  const sec          = theme.palette.secondary.main;
  const { white }   = theme.palette.common;
  const bg           = theme.palette.grey[900];
  const green        = theme.palette.success.main;
  const threeColor = parseInt(p.replace('#', ''), 16);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase]                       = useState<Phase>('scanning');
  const [identifiedEmployee, setIdentifiedEmployee] = useState<Employee | null>(null);
  const [capturedBlob, setCapturedBlob]         = useState<Blob | null>(null);
  const [module, setModule]                     = useState<TestModule>('specialty');
  const [cameraError, setCameraError]           = useState<CameraError | null>(null);
  const [identifyError, setIdentifyError]       = useState<string | null>(null);
  const [startError, setStartError]             = useState<string | null>(null);

  const identifyMutation = useIdentifyEmployeeMutation();
  const startMutation    = useStartTestSessionMutation();

  // ── Camera lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(null);
      } catch (err) {
        if (!active) return;
        setCameraError(
          err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unavailable'
        );
      }
    }

    startCamera();
    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || identifyMutation.isPending) return;

    const blob = await captureFrame(video);
    if (!blob) return;

    setIdentifyError(null);

    identifyMutation.mutate(
      { faceImage: new File([blob], 'frame.jpg', { type: 'image/jpeg' }) },
      {
        onSuccess: (data) => {
          setCapturedBlob(blob);
          setIdentifiedEmployee(data.employee);
          setPhase('identified');
        },
        onError: (err) => setIdentifyError(errorReader(err)),
      }
    );
  }, [identifyMutation]);

  const handleRescan = useCallback(() => {
    setPhase('scanning');
    setIdentifiedEmployee(null);
    setCapturedBlob(null);
    setIdentifyError(null);
    setStartError(null);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
      router.replace(paths.login);
    } catch {
      router.replace(paths.login);
    }
  }, [logoutMutation, router]);

  const handleStartTest = useCallback(() => {
    if (!identifiedEmployee || !capturedBlob || startMutation.isPending) return;

    setStartError(null);

    startMutation.mutate(
      {
        employee: identifiedEmployee.id,
        module,
        faceImage: new File([capturedBlob], 'frame.jpg', { type: 'image/jpeg' }),
      },
      {
        onSuccess: onStarted,
        onError: (err) => {
          const status = (err as any).response?.status;
          setStartError(status === 409 ? tx('testing.faceId.dailyLimit') : errorReader(err));
        },
      }
    );
  }, [capturedBlob, identifiedEmployee, module, onStarted, startMutation, tx]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isIdentifying  = identifyMutation.isPending;
  const isStarting     = startMutation.isPending;
  const isIdentified   = phase === 'identified' && identifiedEmployee !== null;
  const accentColor    = isIdentified ? green : p;

  const scanLabel = (() => {
    if (isIdentifying) return tx('testing.faceId.identifying');
    if (identifyError)  return tx('common.actions.retry');
    return tx('testing.faceId.scan');
  })();

  const cameraOpacity = (() => {
    if (cameraError) return 0;
    if (isIdentified) return 0.6;
    return 0.85;
  })();

  const statusLabel = (() => {
    if (isIdentified) return tx('testing.faceId.identifiedStatus');
    if (isIdentifying) return tx('testing.faceId.identifyingStatus');
    return tx('testing.faceId.readyStatus');
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        bgcolor: bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Three.js background */}
      <ThreeBg color={threeColor} particleCount={80} />

      {/* Camera feed */}
      <Box
        component="video"
        ref={videoRef}
        autoPlay
        muted
        playsInline
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          opacity: cameraOpacity,
          zIndex: 1,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Vignette */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          background: `radial-gradient(ellipse at center, transparent 30%, ${alpha(bg, 0.8)} 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Biometric scanner ───────────────────────────────────────────── */}
      <AnimatePresence>
        {!cameraError && (
          <div
            key="scanner"
            style={{
              position: 'absolute',
              zIndex: 3,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
          <m.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.3 } }}
          >
            <Box sx={{ width: { xs: 288, sm: 352, md: 424 }, height: { xs: 288, sm: 352, md: 424 }, position: 'relative' }}>

              {/* Outermost pulsing halo */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: -16,
                  borderRadius: '50%',
                  border: `1px solid ${alpha(accentColor, 0.5)}`,
                  animation: `${pulseRing} 2.8s ease-in-out infinite`,
                  transition: 'border-color 0.5s ease',
                }}
              />

              {/* Second halo — slower pulse, offset phase */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: '50%',
                  border: `1px solid ${alpha(accentColor, 0.22)}`,
                  animation: `${pulseRing} 2.8s 0.9s ease-in-out infinite`,
                  transition: 'border-color 0.5s ease',
                }}
              />

              {/* Primary rotating arc */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: isIdentified
                    ? `conic-gradient(from 0deg, ${alpha(green, 0.35)} 0%, ${green} 100%)`
                    : `conic-gradient(from 0deg, transparent 52%, ${alpha(p, 0.25)} 63%, ${alpha(p, 0.7)} 74%, ${alpha(sec, 0.95)} 83%, ${sec} 88%, transparent 94%)`,
                  WebkitMask: 'radial-gradient(transparent calc(50% - 3px), #000 calc(50% - 3px) calc(50% + 1.5px), transparent calc(50% + 1.5px))',
                  mask: 'radial-gradient(transparent calc(50% - 3px), #000 calc(50% - 3px) calc(50% + 1.5px), transparent calc(50% + 1.5px))',
                  animation: isIdentified ? 'none' : `${rotateArc} 2s linear infinite`,
                  filter: isIdentified
                    ? `drop-shadow(0 0 6px ${alpha(green, 0.8)})`
                    : `drop-shadow(0 0 5px ${alpha(sec, 0.75)})`,
                  transition: 'background 0.6s ease, filter 0.6s ease',
                }}
              />

              {/* Counter-rotating secondary arc */}
              {!isIdentified && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 5,
                    borderRadius: '50%',
                    background: `conic-gradient(from 120deg, transparent 68%, ${alpha(p, 0.18)} 78%, ${alpha(p, 0.5)} 86%, transparent 93%)`,
                    WebkitMask: 'radial-gradient(transparent calc(50% - 2px), #000 calc(50% - 2px) calc(50% + 1px), transparent calc(50% + 1px))',
                    mask: 'radial-gradient(transparent calc(50% - 2px), #000 calc(50% - 2px) calc(50% + 1px), transparent calc(50% + 1px))',
                    animation: `${rotateArcRev} 3.6s linear infinite`,
                  }}
                />
              )}

              {/* Static base ring */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: `1px solid ${alpha(accentColor, isIdentified ? 0.38 : 0.18)}`,
                  transition: 'border-color 0.5s ease',
                }}
              />

              {/* Inner thin ring */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 20,
                  borderRadius: '50%',
                  background: `conic-gradient(from 0deg, transparent 82%, ${alpha(accentColor, 0.18)} 90%, transparent 100%)`,
                  WebkitMask: 'radial-gradient(transparent calc(50% - 1px), #000 calc(50% - 1px) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                  mask: 'radial-gradient(transparent calc(50% - 1px), #000 calc(50% - 1px) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                  animation: isIdentified ? 'none' : `${rotateArc} 5.5s linear infinite`,
                }}
              />

              {/* Face oval */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '10%',
                  left: '14%',
                  right: '14%',
                  bottom: '6%',
                  borderRadius: '50% / 48%',
                  border: `1.5px solid ${alpha(accentColor, isIdentified ? 0.72 : 0.32)}`,
                  boxShadow: isIdentified
                    ? `0 0 40px ${alpha(accentColor, 0.28)} inset, 0 0 20px ${alpha(accentColor, 0.18)}`
                    : `0 0 18px ${alpha(accentColor, 0.1)} inset`,
                  transition: 'all 0.55s ease',
                }}
              />

              {/* Corner brackets — top-left */}
              <Box sx={{
                position: 'absolute', top: '8%', left: '12%', width: 22, height: 22,
                borderTop: `2px solid ${alpha(accentColor, 0.85)}`,
                borderLeft: `2px solid ${alpha(accentColor, 0.85)}`,
                borderRadius: '3px 0 0 0',
                boxShadow: `0 0 8px ${alpha(accentColor, 0.45)}`,
                animation: `${blink} 2s ease-in-out infinite`,
                transition: 'border-color 0.5s ease',
              }} />
              {/* Corner brackets — top-right */}
              <Box sx={{
                position: 'absolute', top: '8%', right: '12%', width: 22, height: 22,
                borderTop: `2px solid ${alpha(accentColor, 0.85)}`,
                borderRight: `2px solid ${alpha(accentColor, 0.85)}`,
                borderRadius: '0 3px 0 0',
                boxShadow: `0 0 8px ${alpha(accentColor, 0.45)}`,
                animation: `${blink} 2.25s ease-in-out infinite`,
                transition: 'border-color 0.5s ease',
              }} />
              {/* Corner brackets — bottom-left */}
              <Box sx={{
                position: 'absolute', bottom: '4%', left: '12%', width: 22, height: 22,
                borderBottom: `2px solid ${alpha(accentColor, 0.85)}`,
                borderLeft: `2px solid ${alpha(accentColor, 0.85)}`,
                borderRadius: '0 0 0 3px',
                boxShadow: `0 0 8px ${alpha(accentColor, 0.45)}`,
                animation: `${blink} 2.5s ease-in-out infinite`,
                transition: 'border-color 0.5s ease',
              }} />
              {/* Corner brackets — bottom-right */}
              <Box sx={{
                position: 'absolute', bottom: '4%', right: '12%', width: 22, height: 22,
                borderBottom: `2px solid ${alpha(accentColor, 0.85)}`,
                borderRight: `2px solid ${alpha(accentColor, 0.85)}`,
                borderRadius: '0 0 3px 0',
                boxShadow: `0 0 8px ${alpha(accentColor, 0.45)}`,
                animation: `${blink} 2.75s ease-in-out infinite`,
                transition: 'border-color 0.5s ease',
              }} />

              {/* Sweep line */}
              {!isIdentified && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: '15%',
                    right: '15%',
                    height: '3px',
                    background: `linear-gradient(90deg, transparent, ${alpha(p, 0.4)} 15%, ${p} 35%, ${sec} 50%, ${p} 65%, ${alpha(p, 0.4)} 85%, transparent)`,
                    animation: `${sweepLine} 2.6s ease-in-out infinite`,
                    filter: `blur(1.5px)`,
                    boxShadow: `0 0 14px ${alpha(sec, 0.65)}, 0 2px 6px ${alpha(p, 0.35)}`,
                  }}
                />
              )}

              {/* Success checkmark */}
              {isIdentified && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: `${successPop} 0.45s ease forwards`,
                  }}
                >
                  <Iconify
                    icon="solar:check-circle-bold-duotone"
                    sx={{
                      color: green,
                      width: 80,
                      height: 80,
                      filter: `drop-shadow(0 0 18px ${alpha(green, 0.75)}) drop-shadow(0 0 36px ${alpha(green, 0.4)})`,
                    }}
                  />
                </Box>
              )}

              {/* Cardinal dots */}
              {([
                { top: 0,    left: '50%', transform: 'translate(-50%, -4px)' },
                { bottom: 0, left: '50%', transform: 'translate(-50%,  4px)' },
                { left: 0,   top: '50%',  transform: 'translate(-4px, -50%)' },
                { right: 0,  top: '50%',  transform: 'translate( 4px, -50%)' },
              ] as const).map((style, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: accentColor,
                    boxShadow: `0 0 10px ${accentColor}, 0 0 22px ${alpha(accentColor, 0.55)}`,
                    animation: `${blink} ${1.8 + i * 0.28}s ease-in-out infinite`,
                    ...style,
                  }}
                />
              ))}

              {/* Status label */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -52,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 1.25,
                }}
              >
                <Box sx={{ width: 28, height: 1, bgcolor: alpha(accentColor, 0.3) }} />
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                    animation: `${blink} 1.2s ease-in-out infinite`,
                  }}
                />
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: 10,
                    letterSpacing: 2.5,
                    color: alpha(accentColor, 0.85),
                    textTransform: 'uppercase',
                    animation: `${blink} 1.8s ease-in-out infinite`,
                  }}
                >
                  {statusLabel}
                </Typography>
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                    animation: `${blink} 1.4s ease-in-out infinite`,
                  }}
                />
                <Box sx={{ width: 28, height: 1, bgcolor: alpha(accentColor, 0.3) }} />
              </Box>
            </Box>
          </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          zIndex: 10,
          px: { xs: 2, md: 4 },
          pt: { xs: 2, md: 3 },
          pb: 3,
          background: `linear-gradient(to bottom, ${alpha(bg, 0.92)} 0%, transparent 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        {/* Left: identified employee OR default title */}
        <AnimatePresence mode="wait">
          {isIdentified && identifiedEmployee ? (
            <IdentifiedEmployeeBanner
              key="employee"
              employee={identifiedEmployee}
              onRescan={handleRescan}
            />
          ) : (
            <m.div
              key="title"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Stack spacing={0.25}>
                <Typography
                  variant="caption"
                  sx={{ color: alpha(white, 0.5), letterSpacing: 2, textTransform: 'uppercase', fontSize: 10 }}
                >
                  {tx('testing.steps.faceId')}
                </Typography>
                <Typography variant="h6" sx={{ color: white, fontWeight: 700, lineHeight: 1.2 }}>
                  {tx('testing.faceId.identifyTitle')}
                </Typography>
              </Stack>
            </m.div>
          )}
        </AnimatePresence>

        {/* Right: module selector + utilities */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <ModuleSelector
            value={module}
            onChange={setModule}
            disabled={isIdentifying || isStarting}
          />

          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: alpha(white, 0.12), mx: 0.5, my: 0.5 }}
          />

          <LanguagePopover />

          <Tooltip title={tx('common.actions.logout')} placement="bottom">
            <IconButton
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              sx={{
                width: 40,
                height: 40,
                color: alpha(white, 0.55),
                bgcolor: alpha(white, 0.04),
                border: '1px solid',
                borderColor: alpha(white, 0.1),
                transition: 'all 0.18s ease',
                '&:hover': {
                  color: theme.palette.error.light,
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  borderColor: alpha(theme.palette.error.main, 0.3),
                },
              }}
            >
              <Iconify icon="solar:logout-3-bold" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* ── Instruction text ─────────────────────────────────────────────── */}
      {!cameraError && !identifyError && !startError && !isIdentified && (
        <Box
          sx={{
            position: 'absolute',
            zIndex: 10,
            bottom: { xs: '22%', sm: '20%' },
            left: 0, right: 0,
            textAlign: 'center',
            px: 3,
            pointerEvents: 'none',
          }}
        >
          <Typography variant="body2" sx={{ color: alpha(white, 0.6), letterSpacing: 0.5 }}>
            {tx('testing.faceId.instruction')}
          </Typography>
        </Box>
      )}

      {/* ── Error alerts ─────────────────────────────────────────────────── */}
      {(cameraError || identifyError || startError) && (
        <Box
          sx={{
            position: 'absolute',
            zIndex: 10,
            bottom: { xs: '22%', sm: '20%' },
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: 'calc(100% - 32px)', sm: 480 },
          }}
        >
          {cameraError && (
            <Alert
              severity="error"
              sx={{
                bgcolor: alpha(bg, 0.9),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                color: white,
                '& .MuiAlert-icon': { color: theme.palette.error.main },
              }}
            >
              {tx(cameraError === 'denied' ? 'testing.faceId.cameraDenied' : 'testing.faceId.cameraUnavailable')}
            </Alert>
          )}
          {identifyError && (
            <Alert
              severity="warning"
              sx={{
                bgcolor: alpha(bg, 0.9),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                color: white,
                '& .MuiAlert-icon': { color: theme.palette.warning.main },
              }}
            >
              {identifyError}
            </Alert>
          )}
          {startError && (
            <Alert
              severity="error"
              sx={{
                bgcolor: alpha(bg, 0.9),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                color: white,
                '& .MuiAlert-icon': { color: theme.palette.error.main },
              }}
            >
              {startError}
            </Alert>
          )}
        </Box>
      )}

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          zIndex: 10,
          px: { xs: 2, md: 4 },
          pb: { xs: 3, md: 4 },
          pt: 4,
          background: `linear-gradient(to top, ${alpha(bg, 0.92)} 0%, transparent 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Button
          color="inherit"
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          onClick={isIdentified ? handleRescan : onBack}
          disabled={isIdentifying || isStarting}
          sx={{
            color: alpha(white, 0.7),
            backdropFilter: 'blur(12px)',
            bgcolor: alpha(white, 0.05),
            border: '1px solid',
            borderColor: alpha(white, 0.2),
            '&:hover': { bgcolor: alpha(white, 0.1) },
          }}
        >
          {isIdentified ? tx('testing.faceId.notYou') : tx('common.actions.back')}
        </Button>

        {/* Scanning phase: Scan button */}
        {!isIdentified && !cameraError && (
          <LoadingButton
            variant="contained"
            size="large"
            loading={isIdentifying}
            loadingPosition="start"
            startIcon={<Iconify icon="solar:camera-bold" />}
            onClick={handleScan}
            sx={{
              px: 4,
              background: `linear-gradient(135deg, ${p} 0%, ${sec} 100%)`,
              boxShadow: `0 0 24px ${alpha(p, 0.5)}`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                boxShadow: `0 0 36px ${alpha(p, 0.7)}`,
              },
            }}
          >
            {scanLabel}
          </LoadingButton>
        )}

        {/* Identified phase: Start Test button */}
        {isIdentified && (
          <LoadingButton
            variant="contained"
            size="large"
            loading={isStarting}
            loadingPosition="start"
            startIcon={<Iconify icon="solar:play-bold" />}
            onClick={handleStartTest}
            sx={{
              px: 4,
              background: `linear-gradient(135deg, ${green} 0%, ${alpha(green, 0.7)} 100%)`,
              boxShadow: `0 0 24px ${alpha(green, 0.45)}`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${green} 100%)`,
                boxShadow: `0 0 36px ${alpha(green, 0.65)}`,
              },
            }}
          >
            {tx('testing.faceId.startTest')}
          </LoadingButton>
        )}
      </Box>
    </Box>
  );
}
