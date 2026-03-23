import { PublicBoardViewShellV2 } from '../components/views/board-view';
import {
  BoardV2Boundary,
  BoardV2Provider,
  type BoardV2Dependencies,
} from '../context/BoardV2Context';

export interface PublicBoardViewPageV2Props {
  dependencies?: Partial<BoardV2Dependencies>;
}

export function PublicBoardViewPageV2({ dependencies }: PublicBoardViewPageV2Props) {
  return (
    <BoardV2Provider dependencies={dependencies}>
      <BoardV2Boundary>
        <PublicBoardViewShellV2 />
      </BoardV2Boundary>
    </BoardV2Provider>
  );
}
