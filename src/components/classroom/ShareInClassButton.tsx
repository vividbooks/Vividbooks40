import { Monitor, Square, Radio } from 'lucide-react';
import { useClassroomShare } from '../../contexts/ClassroomShareContext';

interface ShareInClassButtonProps {
  documentTitle: string;
  onOpenPanel?: () => void;
  isPanelOpen?: boolean;
}

export function ShareInClassButton({ documentTitle, onOpenPanel, isPanelOpen }: ShareInClassButtonProps) {
  const { state } = useClassroomShare();

  // If already sharing, show active indicator button
  if (state.isSharing && state.currentSession) {
    return (
      <button
        onClick={onOpenPanel}
        className={`hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
          isPanelOpen 
            ? 'bg-red-500 text-white border border-red-500' 
            : 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700'
        }`}
        title="Otevřít panel sdílení"
      >
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${isPanelOpen ? 'bg-white' : 'bg-red-500'}`} />
          <div className={`absolute inset-0 w-2 h-2 rounded-full animate-ping ${isPanelOpen ? 'bg-white' : 'bg-red-500'}`} />
        </div>
        <span>Sdílím: {state.currentSession.className}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpenPanel}
      className={`hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition-colors border ${
        isPanelOpen
          ? 'bg-emerald-500 text-white border-emerald-500'
          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
      }`}
    >
      <Monitor className="w-4 h-4" />
      <span>Sdílet ve třídě</span>
    </button>
  );
}

// Separate header indicator for when sharing is active (for use in other places)
export function TeacherShareHeaderIndicator({ onClick }: { onClick?: () => void }) {
  const { state } = useClassroomShare();

  if (!state.isSharing || !state.currentSession) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition-all bg-red-50 hover:bg-red-100 border border-red-200 text-red-700"
      title="Otevřít panel sdílení"
    >
      <div className="relative">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <div className="absolute inset-0 w-2 h-2 bg-red-500 rounded-full animate-ping" />
      </div>
      <span>Sdílím: {state.currentSession.className}</span>
    </button>
  );
}

