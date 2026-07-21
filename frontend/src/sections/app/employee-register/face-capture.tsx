import { useEffect, useRef, useState } from 'react';
// @mui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { captureFrame } from 'src/utils/camera';
// components
import Iconify from 'src/components/iconify';

type Mode = 'camera' | 'upload';

type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
};

export default function FaceCapture({ value, onChange }: Props) {
  const { tx } = useLocales();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('camera');
  const [cameraError, setCameraError] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Run the camera only in camera mode while no photo has been captured yet.
  useEffect(() => {
    if (mode !== 'camera' || value) return undefined;

    let active = true;
    let stream: MediaStream | null = null;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(false);
      } catch {
        if (active) setCameraError(true);
      }
    })();

    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, value]);

  const setFile = (file: File) => {
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const blob = await captureFrame(video);
    if (!blob) return;
    setFile(new File([blob], 'face.jpg', { type: 'image/jpeg' }));
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setFile(file);
  };

  const handleRetake = () => {
    setPreview(null);
    onChange(null);
  };

  const showCamera = mode === 'camera' && !cameraError;

  const renderMedia = () => {
    if (value && preview) {
      return (
        <Box
          component="img"
          src={preview}
          alt="face"
          sx={{ width: 1, height: 1, objectFit: 'cover' }}
        />
      );
    }
    if (showCamera) {
      return (
        <Box
          component="video"
          ref={videoRef}
          autoPlay
          muted
          playsInline
          sx={{ width: 1, height: 1, objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      );
    }
    return (
      <Stack sx={{ height: 1, px: 3 }} alignItems="center" justifyContent="center" spacing={1}>
        <Iconify icon="solar:gallery-add-bold" width={32} sx={{ color: 'grey.500' }} />
        <Typography variant="body2" sx={{ color: 'common.white', textAlign: 'center' }}>
          {tx('employees.register.face.cameraUnavailable')}
        </Typography>
      </Stack>
    );
  };

  const renderControls = () => {
    if (value) {
      return (
        <Button
          variant="outlined"
          color="inherit"
          onClick={handleRetake}
          startIcon={<Iconify icon="solar:restart-bold" />}
        >
          {tx('employees.register.face.retake')}
        </Button>
      );
    }
    if (showCamera) {
      return (
        <>
          <Button
            variant="contained"
            onClick={handleCapture}
            startIcon={<Iconify icon="solar:camera-bold" />}
          >
            {tx('employees.register.face.capture')}
          </Button>
          <Button variant="text" color="inherit" onClick={() => setMode('upload')}>
            {tx('employees.register.face.upload')}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button
          variant="contained"
          onClick={() => fileInputRef.current?.click()}
          startIcon={<Iconify icon="solar:upload-bold" />}
        >
          {tx('employees.register.face.upload')}
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={() => {
            setCameraError(false);
            setMode('camera');
          }}
        >
          {tx('employees.register.face.useCamera')}
        </Button>
      </>
    );
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{tx('employees.register.face.title')}</Typography>
      <Typography variant="caption" color="text.secondary">
        {tx('employees.register.face.hint')}
      </Typography>

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
        {renderMedia()}
      </Box>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />

      <Stack direction="row" spacing={1} flexWrap="wrap">
        {renderControls()}
      </Stack>
    </Stack>
  );
}
