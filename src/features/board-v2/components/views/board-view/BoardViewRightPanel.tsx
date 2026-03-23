import type { ComponentProps } from 'react';
import { BoardViewClassroomPanel } from './BoardViewClassroomPanel';
import { BoardViewCompetitionPickerPanel } from './BoardViewCompetitionPickerPanel';
import { BoardViewDefaultPanel } from './BoardViewDefaultPanel';
import { BoardViewLiveSessionPanel } from './BoardViewLiveSessionPanel';
import { BoardViewLiveSettingsPanel } from './BoardViewLiveSettingsPanel';
import { BoardViewShareSettingsPanel } from './BoardViewShareSettingsPanel';
import { BoardViewStudentOptionsPanel } from './BoardViewStudentOptionsPanel';

interface BoardViewRightPanelProps {
  classroomShareId: string | null;
  classroomPanelProps: ComponentProps<typeof BoardViewClassroomPanel>;
  sessionId: string | null;
  sessionCode: string | null;
  liveSessionPanelProps: ComponentProps<typeof BoardViewLiveSessionPanel>;
  showLiveSettings: boolean;
  liveSettingsPanelProps: ComponentProps<typeof BoardViewLiveSettingsPanel>;
  showShareSettings: boolean;
  shareSettingsPanelProps: ComponentProps<typeof BoardViewShareSettingsPanel>;
  showCompetitionPicker: boolean;
  competitionPickerPanelProps: ComponentProps<typeof BoardViewCompetitionPickerPanel>;
  showStudentOptions: boolean;
  studentOptionsPanelProps: ComponentProps<typeof BoardViewStudentOptionsPanel>;
  defaultPanelProps: ComponentProps<typeof BoardViewDefaultPanel>;
}

export function BoardViewRightPanel({
  classroomShareId,
  classroomPanelProps,
  sessionId,
  sessionCode,
  liveSessionPanelProps,
  showLiveSettings,
  liveSettingsPanelProps,
  showShareSettings,
  shareSettingsPanelProps,
  showCompetitionPicker,
  competitionPickerPanelProps,
  showStudentOptions,
  studentOptionsPanelProps,
  defaultPanelProps,
}: BoardViewRightPanelProps) {
  if (classroomShareId) {
    return <BoardViewClassroomPanel {...classroomPanelProps} />;
  }

  if (sessionId && sessionCode) {
    return <BoardViewLiveSessionPanel {...liveSessionPanelProps} />;
  }

  if (showLiveSettings) {
    return <BoardViewLiveSettingsPanel {...liveSettingsPanelProps} />;
  }

  if (showShareSettings) {
    return <BoardViewShareSettingsPanel {...shareSettingsPanelProps} />;
  }

  if (showCompetitionPicker) {
    return <BoardViewCompetitionPickerPanel {...competitionPickerPanelProps} />;
  }

  if (showStudentOptions) {
    return <BoardViewStudentOptionsPanel {...studentOptionsPanelProps} />;
  }

  return <BoardViewDefaultPanel {...defaultPanelProps} />;
}
