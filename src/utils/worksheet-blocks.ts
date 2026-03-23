import { WorksheetBlock, generateBlockId } from '../types/worksheet';

function cloneBlock<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function reindexWorksheetBlocks(blocks: WorksheetBlock[]): WorksheetBlock[] {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

export function updateWorksheetBlock(
  blocks: WorksheetBlock[],
  blockId: string,
  updater: (block: WorksheetBlock) => WorksheetBlock
): WorksheetBlock[] {
  return blocks.map((block) => (block.id === blockId ? updater(block) : block));
}

export function removeWorksheetBlock(blocks: WorksheetBlock[], blockId: string): WorksheetBlock[] {
  return reindexWorksheetBlocks(blocks.filter((block) => block.id !== blockId));
}

export function duplicateWorksheetBlock(
  blocks: WorksheetBlock[],
  blockId: string,
  options?: {
    transformDuplicate?: (block: WorksheetBlock) => WorksheetBlock;
  }
): WorksheetBlock[] {
  const blockIndex = blocks.findIndex((block) => block.id === blockId);
  if (blockIndex === -1) return blocks;

  const originalBlock = blocks[blockIndex];
  const duplicatedBlockBase = {
    ...cloneBlock(originalBlock),
    id: generateBlockId(),
  } as WorksheetBlock;
  const duplicatedBlock = options?.transformDuplicate
    ? options.transformDuplicate(duplicatedBlockBase)
    : duplicatedBlockBase;

  return reindexWorksheetBlocks([
    ...blocks.slice(0, blockIndex + 1),
    duplicatedBlock,
    ...blocks.slice(blockIndex + 1),
  ]);
}

export function moveWorksheetBlock(
  blocks: WorksheetBlock[],
  activeId: string,
  overId: string
): WorksheetBlock[] {
  if (activeId === overId) return blocks;

  const oldIndex = blocks.findIndex((block) => block.id === activeId);
  const newIndex = blocks.findIndex((block) => block.id === overId);
  if (oldIndex === -1 || newIndex === -1) return blocks;

  const nextBlocks = [...blocks];
  const [movedBlock] = nextBlocks.splice(oldIndex, 1);
  nextBlocks.splice(newIndex, 0, movedBlock);

  return reindexWorksheetBlocks(nextBlocks);
}

export function moveWorksheetBlockByOffset(
  blocks: WorksheetBlock[],
  blockId: string,
  offset: -1 | 1
): WorksheetBlock[] {
  const currentIndex = blocks.findIndex((block) => block.id === blockId);
  if (currentIndex === -1) return blocks;

  const targetIndex = currentIndex + offset;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;

  const nextBlocks = [...blocks];
  const [movedBlock] = nextBlocks.splice(currentIndex, 1);
  nextBlocks.splice(targetIndex, 0, movedBlock);

  return reindexWorksheetBlocks(nextBlocks);
}
