import { useClassroomShare } from '../../contexts/ClassroomShareContext';

// Simplified student overlay - just a header indicator, no forced navigation
export function StudentShareOverlay() {
  // This component is now deprecated - use StudentShareNotification instead
  // Keeping it here for backwards compatibility but it does nothing
  return null;
}

// Header indicator showing when teacher is sharing
export function StudentShareHeaderIndicator() {
  const { state } = useClassroomShare();
  const { isLocked, activeSession } = state;

  if (!isLocked || !activeSession) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm">
      <div className="relative">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
      </div>
      <span className="text-emerald-700 font-medium">
        {activeSession.teacherName} sdílí
      </span>
    </div>
  );
}
