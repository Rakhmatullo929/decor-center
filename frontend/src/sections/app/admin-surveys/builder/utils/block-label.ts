import type { QuestionBlock } from '../../api/types';

export function blockLabel(block: QuestionBlock, tx: (key: string) => string) {
  return block.title.ru || block.title.uz || tx('surveys.builder.untitledBlock');
}
