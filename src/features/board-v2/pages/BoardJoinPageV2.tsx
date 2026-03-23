import { BoardJoinShellV2 } from '../components/views/board-view';
import {
  BoardV2Boundary,
  BoardV2Provider,
  type BoardV2Dependencies,
} from '../context/BoardV2Context';

export interface BoardJoinPageV2Props {
  dependencies?: Partial<BoardV2Dependencies>;
}

export function BoardJoinPageV2({ dependencies }: BoardJoinPageV2Props) {
  return (
    <BoardV2Provider dependencies={dependencies}>
      <BoardV2Boundary>
        <BoardJoinShellV2 />
      </BoardV2Boundary>
    </BoardV2Provider>
  );
}
