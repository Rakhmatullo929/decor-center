import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import Box from '@mui/material/Box';
import Iconify from 'src/components/iconify';

type Props = {
  width?: number;
  attributes?: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
};

/** Shared drag-handle affordance for sortable blocks/questions (dnd-kit `useSortable`). */
export default function DragHandle({ width = 20, attributes, listeners }: Props) {
  return (
    <Box
      {...attributes}
      {...listeners}
      sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', touchAction: 'none', color: 'text.disabled' }}
    >
      <Iconify icon="mingcute:dots-fill" width={width} />
    </Box>
  );
}
