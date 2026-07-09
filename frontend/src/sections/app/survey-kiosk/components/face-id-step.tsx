import { useCallback, useEffect, useRef, useState } from 'react';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { captureFrame } from 'src/utils/camera';
import { errorReader } from 'src/utils/error-reader';
// components
import Iconify from 'src/components/iconify';
//
import type { KioskEmployee } from '../api/types';
import { useIdentifyEmployeeMutation } from '../api/use-survey-kiosk-api';

// ----------------------------------------------------------------------

type Phase = 'scanning' | 'identified';
type CameraError = 'denied' | 'unavailable';

type Props = {
  onIdentified: (employee: KioskEmployee, faceBlob: Blob) => void;
  onBack: () => void;
  /** Offered after repeated identify failures: fall back to manual name + SMS. */
  onManualFallback?: () => void;
};

const MANUAL_FALLBACK_AFTER = 3;

export default function FaceIdStep({ onIdentified, onBack, onManualFallback }: Props) {
  const { tx } = useLocales();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>('scanning');
  const [identifiedEmployee, setIdentifiedEmployee] = useState<KioskEmployee | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);

  const identifyMutation = useIdentifyEmployeeMutation();

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
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
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
          setFailCount(0);
          setPhase('identified');
        },
        onError: (err) => {
          setIdentifyError(errorReader(err));
          setFailCount((n) => n + 1);
        },
      }
    );
  }, [identifyMutation]);

  const handleRescan = useCallback(() => {
    setPhase('scanning');
    setIdentifiedEmployee(null);
    setCapturedBlob(null);
    setIdentifyError(null);
  }, []);

  const handleContinue = useCallback(() => {
    if (!identifiedEmployee || !capturedBlob) return;
    onIdentified(identifiedEmployee, capturedBlob);
  }, [identifiedEmployee, capturedBlob, onIdentified]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isIdentifying = identifyMutation.isPending;
  const isIdentified = phase === 'identified' && identifiedEmployee !== null;

  const scanLabel = (() => {
    if (isIdentifying) return tx('survey.kiosk.faceId.identifying');
    if (identifyError) return tx('common.actions.retry');
    return tx('survey.kiosk.faceId.scan');
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">{tx('survey.kiosk.faceId.identifyTitle')}</Typography>
        {!isIdentified && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {tx('survey.kiosk.faceId.instruction')}
          </Typography>
        )}
      </Stack>

      {isIdentified && identifiedEmployee ? (
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Avatar
            src={identifiedEmployee.photo ?? undefined}
            alt={identifiedEmployee.fullName}
            sx={{ width: 88, height: 88, fontSize: 32 }}
          >
            {identifiedEmployee.fullName.charAt(0).toUpperCase()}
          </Avatar>
          <Stack spacing={0.5}>
            <Typography variant="h6">{identifiedEmployee.fullName}</Typography>
            {!!identifiedEmployee.specialtyName && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {identifiedEmployee.specialtyName}
              </Typography>
            )}
          </Stack>
          <Button size="small" color="inherit" onClick={handleRescan}>
            {tx('survey.kiosk.faceId.notYou')}
          </Button>
        </Stack>
      ) : (
        <Box
          sx={{
            position: 'relative',
            width: 1,
            aspectRatio: '4 / 3',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'grey.900',
          }}
        >
          {cameraError ? (
            <Stack sx={{ height: 1, px: 3 }} alignItems="center" justifyContent="center" spacing={1.5}>
              <Iconify icon="solar:videocamera-record-bold" width={32} sx={{ color: 'grey.500' }} />
              <Typography variant="body2" sx={{ color: 'common.white', textAlign: 'center' }}>
                {tx(
                  cameraError === 'denied'
                    ? 'survey.kiosk.faceId.cameraDenied'
                    : 'survey.kiosk.faceId.cameraUnavailable'
                )}
              </Typography>
            </Stack>
          ) : (
            <Box
              component="video"
              ref={videoRef}
              autoPlay
              muted
              playsInline
              sx={{ width: 1, height: 1, objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          )}

          {isIdentifying && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha('#000000', 0.4),
              }}
            >
              <CircularProgress sx={{ color: 'common.white' }} />
            </Box>
          )}
        </Box>
      )}

      {identifyError && !isIdentified && <Alert severity="warning">{identifyError}</Alert>}

      {onManualFallback && !isIdentified && failCount >= MANUAL_FALLBACK_AFTER && (
        <Button variant="text" onClick={onManualFallback}>
          {tx('survey.kiosk.faceId.cantRecognize')}
        </Button>
      )}

      <Stack direction="row" spacing={2}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          onClick={isIdentified ? handleRescan : onBack}
          disabled={isIdentifying}
        >
          {tx('common.actions.back')}
        </Button>

        {isIdentified ? (
          <Button fullWidth variant="contained" onClick={handleContinue}>
            {tx('survey.kiosk.faceId.continue')}
          </Button>
        ) : (
          <LoadingButton
            fullWidth
            variant="contained"
            loading={isIdentifying}
            disabled={!!cameraError}
            onClick={handleScan}
          >
            {scanLabel}
          </LoadingButton>
        )}
      </Stack>
    </Stack>
  );
}
