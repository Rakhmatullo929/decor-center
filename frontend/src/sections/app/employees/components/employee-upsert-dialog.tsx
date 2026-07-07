import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
// @mui
import { alpha } from '@mui/material/styles';
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { errorReader } from 'src/utils/error-reader';
// components
import FormProvider, { RHFSelect, RHFSwitch, RHFTextField, RHFUploadAvatar } from 'src/components/hook-form';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import Upload from 'src/components/upload/upload';
//
import { useSpecialtyOptionsQuery } from '../../specialties/api/use-specialties-api';
import { useCreateEmployeeMutation, useUpdateEmployeeMutation } from '../api/use-employees-api';
import { useAddFacePhotoMutation, useDeleteFacePhotoMutation, useFacePhotosQuery } from '../api/use-face-photos-api';
import type { Employee } from '../api/types';
import { buildEmployeeSchema, type EmployeeFormValues } from './utils/employee-schema';

// ----------------------------------------------------------------------

const MAX_PHOTOS = 5;

const KNOWN_FACE_ERROR_CODES = [
  'no_face',
  'multiple_faces',
  'face_too_small',
  'low_quality',
  'duplicate',
  'limit_reached',
  'invalid_image',
];

type Props = {
  open: boolean;
  onClose: VoidFunction;
  employee?: Employee | null;
  onSaved: (employee: Employee, mode: 'create' | 'edit') => void;
};

export default function EmployeeUpsertDialog({ open, onClose, employee, onSaved }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const [submitError, setSubmitError] = useState('');
  const [faceFailures, setFaceFailures] = useState<string[]>([]);
  const [faceUploading, setFaceUploading] = useState(false);

  const isEdit = Boolean(employee);
  const employeeId = employee?.id ?? null;

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();

  const facePhotosQuery = useFacePhotosQuery(employeeId, open && isEdit);
  const photos = facePhotosQuery.data ?? [];
  const addFaceMutation = useAddFacePhotoMutation();
  const deleteFaceMutation = useDeleteFacePhotoMutation();

  const defaultValues = useMemo<EmployeeFormValues>(
    () => ({
      fullName: employee?.fullName ?? '',
      specialty: employee?.specialty ?? '',
      phone: employee?.phone ?? '',
      photo: employee?.photo ?? null,
      isActive: employee?.isActive ?? true,
      hireDate: employee?.hireDate ?? '',
      workExperience: employee?.workExperience ?? '',
    }),
    [employee]
  );

  const methods = useForm<EmployeeFormValues>({
    resolver: yupResolver(buildEmployeeSchema(tx)),
    defaultValues,
    mode: 'onChange',
  });

  const {
    reset,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      setSubmitError('');
      setFaceFailures([]);
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  const handleDropPhoto = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setValue('photo', Object.assign(file, { preview: URL.createObjectURL(file) }), {
          shouldValidate: true,
        });
      }
    },
    [setValue]
  );

  const readFaceError = useCallback(
    (error: unknown): string => {
      const data = (error as { response?: { data?: { code?: unknown } } })?.response?.data;
      const raw = Array.isArray(data?.code) ? data?.code?.[0] : data?.code;
      const code = typeof raw === 'string' && KNOWN_FACE_ERROR_CODES.includes(raw) ? raw : null;
      return code ? tx(`employees.facePhotos.errors.${code}`) : errorReader(error);
    },
    [tx]
  );

  const handleFaceDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!employeeId || !acceptedFiles.length) return;
      setFaceFailures([]);
      setFaceUploading(true);
      const failed: string[] = [];
      let added = 0;
      for (let i = 0; i < acceptedFiles.length; i += 1) {
        const file = acceptedFiles[i];
        try {
          // eslint-disable-next-line no-await-in-loop
          await addFaceMutation.mutateAsync({ employeeId, photo: file });
          added += 1;
        } catch (error) {
          failed.push(`${file.name}: ${readFaceError(error)}`);
        }
      }
      setFaceUploading(false);
      setFaceFailures(failed);
      await facePhotosQuery.refetch();
      if (added) enqueueSnackbar(tx('employees.facePhotos.toasts.added'));
      if (failed.length) enqueueSnackbar(tx('employees.facePhotos.toasts.someFailed'), { variant: 'warning' });
    },
    [employeeId, addFaceMutation, facePhotosQuery, enqueueSnackbar, tx, readFaceError]
  );

  const handleFaceDelete = useCallback(
    (photoId: number) => {
      if (!employeeId) return;
      deleteFaceMutation.mutate(
        { employeeId, photoId },
        {
          onSuccess: () => {
            facePhotosQuery.refetch();
            enqueueSnackbar(tx('employees.facePhotos.toasts.deleted'));
          },
        }
      );
    },
    [employeeId, deleteFaceMutation, facePhotosQuery, enqueueSnackbar, tx]
  );

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const photoFile = values.photo instanceof File ? values.photo : undefined;
      const saved = isEdit
        ? await updateMutation.mutateAsync({
            id: (employee as Employee).id,
            payload: {
              fullName: values.fullName,
              specialty: Number(values.specialty),
              phone: values.phone,
              isActive: values.isActive,
              hireDate: values.hireDate || null,
              workExperience: values.workExperience === '' ? null : Number(values.workExperience),
              ...(photoFile ? { photo: photoFile } : {}),
            },
          })
        : await createMutation.mutateAsync({
            fullName: values.fullName,
            specialty: Number(values.specialty),
            phone: values.phone,
            isActive: values.isActive,
            hireDate: values.hireDate || null,
            workExperience: values.workExperience === '' ? null : Number(values.workExperience),
            photo: photoFile as File,
          });

      enqueueSnackbar(tx(isEdit ? 'employees.toasts.updated' : 'employees.toasts.created'));
      onSaved(saved, isEdit ? 'edit' : 'create');
      onClose();
    } catch (error) {
      // Typical case: backend Face ID service found no face in the photo (SRS §4.3).
      setSubmitError(errorReader(error as Parameters<typeof errorReader>[0]));
    }
  });

  const atLimit = photos.length >= MAX_PHOTOS;

  return (
    <Dialog fullWidth maxWidth={isEdit ? 'md' : 'sm'} open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>
          {tx(isEdit ? 'employees.form.editTitle' : 'employees.form.createTitle')}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {!!submitError && <Alert severity="error">{submitError}</Alert>}

            <Stack alignItems="center" spacing={1}>
              <RHFUploadAvatar name="photo" onDrop={handleDropPhoto} />
              <Typography variant="caption" color="text.secondary" align="center">
                {tx('employees.form.photoHint')}
              </Typography>
            </Stack>

            <RHFTextField name="fullName" label={`${tx('employees.form.fullName')} *`} />

            <RHFTextField
              name="phone"
              label={`${tx('employees.form.phone')} *`}
              placeholder="+998901234567"
            />

            <RHFSelect name="specialty" label={`${tx('employees.form.specialty')} *`}>
              {specialtyOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </RHFSelect>

            <RHFTextField
              name="hireDate"
              type="date"
              label={tx('employees.form.hireDate')}
              InputLabelProps={{ shrink: true }}
            />

            <RHFTextField
              name="workExperience"
              type="number"
              label={tx('employees.form.workExperience')}
              InputProps={{ inputProps: { min: 0 } }}
            />

            {isEdit && <RHFSwitch name="isActive" label={tx('employees.form.active')} />}

            {isEdit && (
              <>
                <Divider />

                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1">{tx('employees.actions.managePhotos')}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tx('employees.facePhotos.count', { count: photos.length, max: MAX_PHOTOS })}
                    </Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    {tx('employees.facePhotos.hint')}
                  </Typography>

                  {!!faceFailures.length && (
                    <Alert severity="warning" onClose={() => setFaceFailures([])}>
                      <Stack component="ul" sx={{ m: 0, pl: 2 }}>
                        {faceFailures.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </Stack>
                    </Alert>
                  )}

                  {facePhotosQuery.isPending && (
                    <Stack alignItems="center" sx={{ py: 3 }}>
                      <CircularProgress size={28} />
                    </Stack>
                  )}

                  {!facePhotosQuery.isPending && photos.length === 0 && (
                    <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
                      {tx('employees.facePhotos.empty')}
                    </Typography>
                  )}

                  {!facePhotosQuery.isPending && photos.length > 0 && (
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                      }}
                    >
                      {photos.map((photo) => (
                        <Box
                          key={photo.id}
                          sx={{
                            position: 'relative',
                            paddingTop: '100%',
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: (theme) => `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                          }}
                        >
                          <Box
                            component="img"
                            src={photo.photo}
                            alt={`face-${photo.id}`}
                            sx={{ position: 'absolute', inset: 0, width: 1, height: 1, objectFit: 'cover' }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleFaceDelete(photo.id)}
                            disabled={deleteFaceMutation.isPending}
                            aria-label={tx('common.actions.delete')}
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              color: (theme) => alpha(theme.palette.common.white, 0.9),
                              bgcolor: (theme) => alpha(theme.palette.grey[900], 0.6),
                              '&:hover': { bgcolor: (theme) => alpha(theme.palette.grey[900], 0.8) },
                            }}
                          >
                            <Iconify icon="mingcute:close-line" width={16} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}

                  <Stack spacing={1}>
                    <Typography variant="subtitle2">{tx('employees.facePhotos.add')}</Typography>
                    <Upload
                      multiple
                      disabled={faceUploading || atLimit}
                      accept={{ 'image/*': [] }}
                      onDrop={handleFaceDrop}
                    />
                    {faceUploading && (
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          {tx('employees.facePhotos.uploading')}
                        </Typography>
                      </Stack>
                    )}
                    {atLimit && (
                      <Typography variant="caption" color="warning.main">
                        {tx('employees.facePhotos.errors.limit_reached')}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={onClose}>
            {tx('common.actions.cancel')}
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {tx('common.actions.save')}
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}
