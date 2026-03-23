import { BoardStudentShellV2 } from '../components/views/board-view';
import {
  BoardV2Boundary,
  BoardV2Provider,
  type BoardV2Dependencies,
} from '../context/BoardV2Context';

export interface BoardStudentPageV2Props {
  dependencies?: Partial<BoardV2Dependencies>;
}

export function BoardStudentPageV2({ dependencies }: BoardStudentPageV2Props) {
  return (
    <BoardV2Provider dependencies={dependencies}>
      <BoardV2Boundary>
        <BoardStudentShellV2 />
      </BoardV2Boundary>
    </BoardV2Provider>
  );
}
