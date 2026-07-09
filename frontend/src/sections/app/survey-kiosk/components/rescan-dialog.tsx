import { useEffect, useRef, useState } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import { captureFrame } from 'src/utils/camera';

type CameraError = 'denied' | 'unavailable';

type Props = {
  open: boolean;
  onCaptured: (blob: Blob) => void;
  onCancel: () => void;
};

/**
 * Re-opens the camera for one fresh frame without touching the already-established
 * employee/OTP session — used when the captured frame from the original face-id scan
 * didn't survive (e.g. a page refresh) but a survey is about to start (see due-surveys-view.tsx).
 */
export default function RescanDialog({ open, onCaptured, onCancel }: Props) {
  const { tx } = useLocales();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

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
  }, [open]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || capturing) return;
    setCapturing(true);
    const blob = await captureFrame(video);
    setCapturing(false);
    if (blob) onCaptured(blob);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{tx('survey.kiosk.rescan.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {tx('survey.kiosk.rescan.instruction')}
          </Typography>

          {cameraError ? (
            <Alert severity="error" sx={{ width: 1 }}>
              {tx(
                cameraError === 'denied'
                  ? 'survey.kiosk.rescan.cameraDenied'
                  : 'survey.kiosk.rescan.cameraUnavailable'
              )}
            </Alert>
          ) : (
            <Box
              sx={{
                width: 1,
                aspectRatio: '4 / 3',
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'grey.900',
              }}
            >
              <Box
                component="video"
                ref={videoRef}
                autoPlay
                muted
                playsInline
                sx={{ width: 1, height: 1, objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onCancel}>
          {tx('common.actions.cancel')}
        </Button>
        <LoadingButton
          variant="contained"
          loading={capturing}
          disabled={!!cameraError}
          startIcon={<Iconify icon="solar:camera-bold" />}
          onClick={handleCapture}
        >
          {tx(capturing ? 'survey.kiosk.rescan.capturing' : 'survey.kiosk.rescan.capture')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
