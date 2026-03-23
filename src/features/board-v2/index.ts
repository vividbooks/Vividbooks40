export { boardPersistenceAdapter } from './adapters/boardPersistenceAdapter';
export { boardCommentsAdapter } from './adapters/boardCommentsAdapter';
export { boardSessionAdapter } from './adapters/boardSessionAdapter';
export { boardClassroomAdapter } from './adapters/boardClassroomAdapter';
export { useBoardRoutingAdapter } from './adapters/boardRoutingAdapter';
export {
  BoardV2Boundary,
  BoardV2Provider,
  useBoardV2Dependencies,
  useBoardV2Runtime,
  type BoardV2Dependencies,
  type BoardV2ProviderProps,
} from './context/BoardV2Context';
export { boardRoutes } from './routes/boardRoutes';
export { BoardEditorShellV2 } from './components/views/board-editor';
export {
  BoardJoinShellV2,
  BoardPresentationShellV2,
  BoardResultsShellV2,
  BoardStudentShellV2,
  BoardViewShellV2,
  PublicBoardViewShellV2,
} from './components/views/board-view';
export { BoardEditorPageV2 } from './pages/BoardEditorPageV2';
export { BoardViewPageV2 } from './pages/BoardViewPageV2';
export { PublicBoardViewPageV2 } from './pages/PublicBoardViewPageV2';
export { BoardResultsPageV2 } from './pages/BoardResultsPageV2';
export { BoardJoinPageV2 } from './pages/BoardJoinPageV2';
export { BoardStudentPageV2 } from './pages/BoardStudentPageV2';
export { BoardPresentPageV2 } from './pages/BoardPresentPageV2';
export { cloneBoardJson, cloneBoardSlides, isQuizLike } from './utils/boardJsonCompat';
export {
  getBoardActivityTypeOptions,
  getBoardSlideTypeById,
  getBoardSlideTypeOptions,
  getBoardToolTypeOptions,
} from './registry/boardSlideRegistry';
