/**
 * Re-export from the refactored board/ module.
 * This file exists to preserve backwards-compatible imports:
 *   import { BoardSlideView } from './BoardSlideView'  ← still works
 */
export { BoardSlideView, BoardSlideView as default } from './board/index';
export type { BoardSlideViewProps } from './board/index';
