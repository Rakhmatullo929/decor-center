import { useCallback, useEffect, useRef, useState } from 'react';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { blobToBase64, captureFrame } from 'src/utils/camera';
// components
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type CameraError = 'denied' | 'unavailable';

type Props = {
  onCapture: (faceImageBase64: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
};

export default function SubmitFaceStep({ onCapture, onCancel, isSubmitting, errorMessage }: Props) {
  const { tx } = useLocales();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);

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

  const handleConfirm = useCallback(async () => {
    const video = videoRef.current;
    if (!video || isSubmitting) return;
    const blob = await captureFrame(video);
    if (!blob) return;
    const base64 = await blobToBase64(blob);
    onCapture(base64);
  }, [isSubmitting, onCapture]);

  return (
    <Stack spacing={3} alignItems="center" sx={{ maxWidth: 480, mx: 'auto', width: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, textAlign: 'center' }}>
        {tx('testing.submitFace.title')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        {tx('testing.submitFace.instruction')}
      </Typography>

      <Box
        sx={{
          position: 'relative',
          width: 280,
          height: 280,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid',
          borderColor: cameraError ? 'error.main' : 'primary.main',
          bgcolor: 'grey.900',
        }}
      >
        <Box
          component="video"
          ref={videoRef}
          autoPlay
          muted
          playsInline
          sx={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      </Box>

      {cameraError && (
        <Alert severity="error" sx={{ width: 1 }}>
          {tx(cameraError === 'denied' ? 'testing.faceId.cameraDenied' : 'testing.faceId.cameraUnavailable')}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="warning" sx={{ width: 1 }}>
          {tx(errorMessage)}
        </Alert>
      )}

      <Stack direction="row" spacing={2}>
        <Button color="inherit" onClick={onCancel} disabled={isSubmitting}>
          {tx('common.actions.back')}
        </Button>
        <LoadingButton
          variant="contained"
          size="large"
          loading={isSubmitting}
          loadingPosition="start"
          disabled={Boolean(cameraError)}
          startIcon={<Iconify icon="solar:camera-bold" />}
          onClick={handleConfirm}
        >
          {tx('testing.submitFace.confirm')}
        </LoadingButton>
      </Stack>
    </Stack>
  );
}
