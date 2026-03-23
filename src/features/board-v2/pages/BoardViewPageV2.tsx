import { BoardViewShellV2 } from '../components/views/board-view';
import {
  BoardV2Boundary,
  BoardV2Provider,
  type BoardV2Dependencies,
} from '../context/BoardV2Context';

export interface BoardViewPageV2Props {
  dependencies?: Partial<BoardV2Dependencies>;
}

export function BoardViewPageV2({ dependencies }: BoardViewPageV2Props) {
  return (
    <BoardV2Provider dependencies={dependencies}>
      <BoardV2Boundary>
        <BoardViewShellV2 />
      </BoardV2Boundary>
    </BoardV2Provider>
  );
}
