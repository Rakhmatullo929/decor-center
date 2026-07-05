import { useParams } from 'react-router-dom';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hook';

import BlockCardPreview from './components/block-card-preview';
import BlockListRow from './components/block-list-row';
import BuilderSkeleton from './components/builder-skeleton';
import { useSurveyBuilder } from './hooks/use-survey-builder';

export default function SurveyBlocksView() {
  const router = useRouter();
  const settings = useSettingsContext();

  const { testId: testIdParam } = useParams();
  const testId = Number(testIdParam);

  const {
    tx,
    canWrite,
    testQuery,
    blocks,
    activeDrag,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleAddBlock,
    handleDeleteBlock,
    handleBlockTitleChange,
  } = useSurveyBuilder(testId);

  if (testQuery.isLoading) {
    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <BuilderSkeleton />
      </Container>
    );
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.builder.blocksTitle')}
        links={[
          { name: tx('surveys.tests.title'), href: paths.app.surveys.tests },
          { name: testQuery.data?.title ?? '' },
        ]}
        action={
          canWrite && (
            <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleAddBlock}>
              {tx('surveys.builder.actions.addBlock')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {blocks.length === 0 ? (
        <Paper variant="outlined">
          <EmptyContent filled title={tx('surveys.builder.emptyBlocks')} sx={{ py: 10 }} />
        </Paper>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blocks.map((b) => `block-${b.id}`)} strategy={verticalListSortingStrategy}>
            <Stack spacing={2}>
              {blocks.map((block, blockIndex) => (
                <BlockListRow
                  key={block.id}
                  block={block}
                  blockIndex={blockIndex}
                  onTitleChange={(title) => handleBlockTitleChange(block.id, title)}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onOpen={() => router.push(paths.app.surveys.block(testId, block.id))}
                />
              ))}
            </Stack>
          </SortableContext>
          <DragOverlay>
            {activeDrag?.kind === 'block' && (
              <BlockCardPreview block={activeDrag.block} blockIndex={activeDrag.blockIndex} />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </Container>
  );
}
