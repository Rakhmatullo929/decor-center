// @mui
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import Iconify from 'src/components/iconify';
//
import type { TestModule } from '../api/types';

// ----------------------------------------------------------------------

const MODULE_CARDS: Array<{
  module: TestModule;
  icon: string;
  titleKey: string;
  hintKey: string;
}> = [
  {
    module: 'specialty',
    icon: 'solar:diploma-bold-duotone',
    titleKey: 'common.modules.specialty',
    hintKey: 'testing.modules.specialtyHint',
  },
  {
    module: 'tech_safety',
    icon: 'solar:shield-check-bold-duotone',
    titleKey: 'common.modules.techSafety',
    hintKey: 'testing.modules.techSafetyHint',
  },
  {
    module: 'industrial_safety',
    icon: 'solar:danger-triangle-bold-duotone',
    titleKey: 'common.modules.industrialSafety',
    hintKey: 'testing.modules.industrialSafetyHint',
  },
];

type Props = {
  onSelect: (module: TestModule) => void;
};

/** Step 1 — module selection: professional knowledge / tech safety / industrial safety. */
export default function ModuleStep({ onSelect }: Props) {
  const { tx } = useLocales();

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{tx('testing.steps.module')}</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        {MODULE_CARDS.map((card) => (
          <Card key={card.module} sx={{ flex: 1 }}>
            <CardActionArea onClick={() => onSelect(card.module)} sx={{ height: 1, p: 4 }}>
              <Stack spacing={2} alignItems="center" textAlign="center">
                <Iconify icon={card.icon} width={64} sx={{ color: 'primary.main' }} />
                <Typography variant="h6">{tx(card.titleKey)}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {tx(card.hintKey)}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
