import { useCallback, useEffect, useRef, useState } from 'react';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
// hooks
import useLocales from 'src/locales/use-locales';
import { useRouter } from 'src/routes/hook';
import { paths } from 'src/routes/paths';
// utils
import { captureFrame } from 'src/utils/camera';
import { errorReader } from 'src/utils/error-reader';
// components
import Iconify from 'src/components/iconify';
//
import type { Employee } from '../../employees/api/types';
import { useIdentifyEmployeeMutation } from '../../testing/api/use-testing-api';

// ----------------------------------------------------------------------

type CameraError = 'denied' | 'unavailable';

type Props = {
  open: boolean;
  onClose: VoidFunction;
};

export default function EmployeeSelectDialog({ open, onClose }: Props) {
  const { tx } = useLocales();
  const router = useRouter();
  const theme = useTheme();
  const green = theme.palette.success.main;
  const primary = theme.palette.primary.main;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [identified, setIdentified] = useState<Employee | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const identifyMutation = useIdentifyEmployeeMutation();

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setIdentified(null);
      setScanError(null);
      setCameraError(null);
    }
  }, [open]);

  // Camera lifecycle
  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return undefined;
    }

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

  const handleScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || identifyMutation.isPending) return;

    const blob = await captureFrame(video);
    if (!blob) return;

    setScanError(null);

    identifyMutation.mutate(
      { faceImage: new File([blob], 'frame.jpg', { type: 'image/jpeg' }) },
      {
        onSuccess: (data) => setIdentified(data.employee),
        onError: (err) => setScanError(errorReader(err)),
      }
    );
  }, [identifyMutation]);

  const handleRescan = useCallback(() => {
    setIdentified(null);
    setScanError(null);
  }, []);

  const handleContinue = () => {
    if (!identified) return;
    router.push(paths.app.medical.create(identified.id));
    onClose();
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>{tx('medical.dialogs.selectEmployee.title')}</DialogTitle>

      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }} alignItems="center">
          {!identified ? (
            <>
              {/* Camera preview */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  bgcolor: 'grey.900',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: cameraError ? 'error.main' : alpha(primary, 0.3),
                }}
              >
                {!cameraError && (
                  <Box
                    component="video"
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                    }}
                  />
                )}

                {/* Face oval guide */}
                {!cameraError && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <Box
                      sx={{
                        width: '52%',
                        height: '78%',
                        border: `2px solid ${alpha(primary, 0.65)}`,
                        borderRadius: '50% / 45%',
                        boxShadow: `0 0 0 9999px ${alpha('rgb(0,0,0)', 0.35)}`,
                      }}
                    />
                  </Box>
                )}

                {/* Camera error state */}
                {cameraError && (
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{ height: '100%', p: 2, textAlign: 'center' }}
                    spacing={1}
                  >
                    <Iconify
                      icon="solar:camera-slash-bold"
                      sx={{ width: 40, height: 40, color: 'error.main' }}
                    />
                    <Typography variant="caption" color="error.main">
                      {tx(
                        cameraError === 'denied'
                          ? 'medical.dialogs.selectEmployee.cameraDenied'
                          : 'medical.dialogs.selectEmployee.cameraUnavailable'
                      )}
                    </Typography>
                  </Stack>
                )}
              </Box>

              {/* Instruction */}
              {!cameraError && (
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  {tx('medical.dialogs.selectEmployee.faceInstruction')}
                </Typography>
              )}

              {/* Scan error */}
              {scanError && (
                <Alert severity="warning" sx={{ width: '100%' }}>
                  {scanError}
                </Alert>
              )}

              {/* Scan button */}
              {!cameraError && (
                <LoadingButton
                  variant="contained"
                  fullWidth
                  loading={identifyMutation.isPending}
                  startIcon={<Iconify icon="solar:camera-bold" />}
                  onClick={handleScan}
                >
                  {scanError
                    ? tx('medical.dialogs.selectEmployee.retryButton')
                    : tx('medical.dialogs.selectEmployee.scanButton')}
                </LoadingButton>
              )}
            </>
          ) : (
            /* Identified employee card */
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                width: '100%',
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${alpha(green, 0.4)}`,
                bgcolor: alpha(green, 0.07),
              }}
            >
              <Avatar
                src={identified.photo ?? undefined}
                alt={identified.fullName}
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: alpha(primary, 0.15),
                  color: primary,
                  fontWeight: 700,
                  border: `2px solid ${alpha(green, 0.5)}`,
                }}
              >
                {identified.fullName.charAt(0).toUpperCase()}
              </Avatar>

              <Stack flex={1} spacing={0.25} minWidth={0}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: green,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  {tx('medical.dialogs.selectEmployee.identified')}
                </Typography>
                <Typography variant="subtitle2" noWrap>
                  {identified.fullName}
                </Typography>
                {identified.specialtyName && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {identified.specialtyName}
                  </Typography>
                )}
              </Stack>

              <Button
                size="small"
                color="inherit"
                onClick={handleRescan}
                sx={{ flexShrink: 0, fontSize: 11 }}
              >
                {tx('medical.dialogs.selectEmployee.notYou')}
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {tx('common.actions.cancel')}
        </Button>
        <Button variant="contained" onClick={handleContinue} disabled={!identified}>
          {tx('common.actions.next')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
