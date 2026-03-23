import { BoardResultsShellV2 } from '../components/views/board-view';
import {
  BoardV2Boundary,
  BoardV2Provider,
  type BoardV2Dependencies,
} from '../context/BoardV2Context';

export interface BoardResultsPageV2Props {
  dependencies?: Partial<BoardV2Dependencies>;
}

export function BoardResultsPageV2({ dependencies }: BoardResultsPageV2Props) {
  return (
    <BoardV2Provider dependencies={dependencies}>
      <BoardV2Boundary>
        <BoardResultsShellV2 />
      </BoardV2Boundary>
    </BoardV2Provider>
  );
}
