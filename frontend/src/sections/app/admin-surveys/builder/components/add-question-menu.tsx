import { useState } from 'react';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';

import type { QuestionType } from '../../api/types';
import { QUESTION_TYPE_GROUPS, QUESTION_TYPE_META } from '../utils/question-type-meta';

type Props = {
  onSelect: (type: QuestionType) => void;
  buttonProps?: Record<string, unknown>;
};

export default function AddQuestionMenu({ onSelect, buttonProps }: Props) {
  const { tx } = useLocales();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<Iconify icon="mingcute:add-line" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        {...buttonProps}
      >
        {tx('surveys.builder.actions.addQuestion')}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} sx={{ maxHeight: 480 }}>
        {/* MUI's Menu clones each direct child to wire up keyboard navigation, so
            the groups must be a flat array — a Fragment per group breaks that. */}
        {QUESTION_TYPE_GROUPS.flatMap((group) => [
          <ListSubheader key={group.labelKey} sx={{ lineHeight: '32px' }}>
            {tx(group.labelKey)}
          </ListSubheader>,
          ...group.types.map((type) => (
            <MenuItem
              key={type}
              onClick={() => {
                onSelect(type);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <Iconify icon={QUESTION_TYPE_META[type].icon} />
              </ListItemIcon>
              <ListItemText>{tx(`surveys.builder.types.${type}`)}</ListItemText>
            </MenuItem>
          )),
        ])}
      </Menu>
    </>
  );
}
