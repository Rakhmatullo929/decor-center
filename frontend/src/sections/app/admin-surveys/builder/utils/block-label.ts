import type { QuestionBlock } from '../../api/types';

export function blockLabel(block: QuestionBlock, tx: (key: string) => string) {
  return block.title || tx('surveys.builder.untitledBlock');
}
