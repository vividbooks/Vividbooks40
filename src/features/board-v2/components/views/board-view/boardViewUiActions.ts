import type { Quiz } from '../../../../../types/quiz';

export async function copyBoardText({
  text,
  onCopied,
  timeoutMs = 2000,
}: {
  text: string;
  onCopied?: (copied: boolean) => void;
  timeoutMs?: number;
}): Promise<void> {
  await navigator.clipboard.writeText(text);
  onCopied?.(true);
  window.setTimeout(() => onCopied?.(false), timeoutMs);
}

export function navigateToBoardLibrary(navigate: (to: string | number) => void): void {
  navigate('/library/my-content');
}

export function toggleBoardOsnovaPanel({
  showOsnovaPanel,
  setShowOsnovaPanel,
  setShowRightPanel,
}: {
  showOsnovaPanel: boolean;
  setShowOsnovaPanel: (value: boolean) => void;
  setShowRightPanel: (value: boolean) => void;
}): void {
  const opening = !showOsnovaPanel;
  setShowOsnovaPanel(opening);
  if (opening) setShowRightPanel(false);
}

export function toggleBoardRightPanel({
  showRightPanel,
  setShowRightPanel,
  setShowOsnovaPanel,
}: {
  showRightPanel: boolean;
  setShowRightPanel: (value: boolean) => void;
  setShowOsnovaPanel: (value: boolean) => void;
}): void {
  const opening = !showRightPanel;
  setShowRightPanel(opening);
  if (opening) setShowOsnovaPanel(false);
}

export function openBoardEndDialog(setShowEndDialog: (value: boolean) => void): void {
  setShowEndDialog(true);
}

export function closeBoardEndDialog(setShowEndDialog: (value: boolean) => void): void {
  setShowEndDialog(false);
}

export function openBoardMobileMenu(setShowMobileMenu: (value: boolean) => void): void {
  setShowMobileMenu(true);
}

export function closeBoardMobileMenu(setShowMobileMenu: (value: boolean) => void): void {
  setShowMobileMenu(false);
}

export function closeBoardShareSettings({
  setShowShareSettings,
  setShareLink,
}: {
  setShowShareSettings: (value: boolean) => void;
  setShareLink: (value: string | null) => void;
}): void {
  setShowShareSettings(false);
  setShareLink(null);
}

export function openBoardQrPopup({
  mode,
  setShowQRPopup,
}: {
  mode: 'qr' | 'code';
  setShowQRPopup: (value: 'qr' | 'code' | null) => void;
}): void {
  setShowQRPopup(mode);
}

export function closeBoardQrPopup(setShowQRPopup: (value: 'qr' | 'code' | null) => void): void {
  setShowQRPopup(null);
}

export function openBoardShareEditDialog(setShowShareEditDialog: (value: boolean) => void): void {
  setShowShareEditDialog(true);
}

export function openBoardStudentOptions(setShowStudentOptions: (value: boolean) => void): void {
  setShowStudentOptions(true);
}

export function closeBoardStudentOptions(setShowStudentOptions: (value: boolean) => void): void {
  setShowStudentOptions(false);
}

export function openBoardLiveSettings(setShowLiveSettings: (value: boolean) => void): void {
  setShowLiveSettings(true);
}

export function closeBoardLiveSettings(setShowLiveSettings: (value: boolean) => void): void {
  setShowLiveSettings(false);
}

export function openBoardShareSettings(setShowShareSettings: (value: boolean) => void): void {
  setShowShareSettings(true);
}

export function closeBoardMobileMenuAndRun({
  setShowMobileMenu,
  action,
}: {
  setShowMobileMenu: (value: boolean) => void;
  action: () => void;
}): void {
  setShowMobileMenu(false);
  action();
}

export function printBoardWorksheet({
  quiz,
  createWorksheetFromBoard,
  saveWorksheet,
  navigate,
}: {
  quiz: Quiz;
  createWorksheetFromBoard: (quiz: Quiz) => { id: string };
  saveWorksheet: (worksheet: { id: string }) => void;
  navigate: (to: string) => void;
}): void {
  const worksheet = createWorksheetFromBoard(quiz);
  saveWorksheet(worksheet);
  navigate(`/print/${worksheet.id}`);
}
