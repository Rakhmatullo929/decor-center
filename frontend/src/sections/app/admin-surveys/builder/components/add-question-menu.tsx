import { useState } from 'react';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';

import { IMPLEMENTED_QUESTION_TYPES } from '../../api/types';
import type { QuestionType } from '../../api/types';
import { QUESTION_TYPE_META, RESERVED_QUESTION_TYPES } from '../utils/question-type-meta';

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
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        {IMPLEMENTED_QUESTION_TYPES.map((type) => (
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
        ))}
        {RESERVED_QUESTION_TYPES.map((type) => (
          <Tooltip key={type} title={tx('surveys.builder.comingSoon')} placement="right">
            <span>
              <MenuItem disabled>
                <ListItemIcon>
                  <Iconify icon={QUESTION_TYPE_META[type].icon} />
                </ListItemIcon>
                <ListItemText>{tx(`surveys.builder.types.${type}`)}</ListItemText>
              </MenuItem>
            </span>
          </Tooltip>
        ))}
      </Menu>
    </>
  );
}
