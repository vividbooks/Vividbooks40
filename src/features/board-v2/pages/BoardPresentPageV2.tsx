import { BoardPresentationShellV2 } from '../components/views/board-view';
import {
  BoardV2Boundary,
  BoardV2Provider,
  type BoardV2Dependencies,
} from '../context/BoardV2Context';

export interface BoardPresentPageV2Props {
  dependencies?: Partial<BoardV2Dependencies>;
}

export function BoardPresentPageV2({ dependencies }: BoardPresentPageV2Props) {
  return (
    <BoardV2Provider dependencies={dependencies}>
      <BoardV2Boundary>
        <BoardPresentationShellV2 />
      </BoardV2Boundary>
    </BoardV2Provider>
  );
}
