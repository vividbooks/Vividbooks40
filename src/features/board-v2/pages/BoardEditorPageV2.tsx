import { BoardEditorShellV2, type BoardEditorShellV2Props } from '../components/views/board-editor';
import {
  BoardV2Boundary,
  BoardV2Provider,
  type BoardV2Dependencies,
} from '../context/BoardV2Context';

export interface BoardEditorPageV2Props extends BoardEditorShellV2Props {
  dependencies?: Partial<BoardV2Dependencies>;
}

export function BoardEditorPageV2({ theme = 'light', dependencies }: BoardEditorPageV2Props) {
  return (
    <BoardV2Provider dependencies={dependencies}>
      <BoardV2Boundary>
        <BoardEditorShellV2 theme={theme} />
      </BoardV2Boundary>
    </BoardV2Provider>
  );
}
