import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Users, 
  Radio, 
  Square, 
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Eye,
  EyeOff,
  UserPlus
} from 'lucide-react';
import { useClassroomShare } from '../../contexts/ClassroomShareContext';
import { MOCK_CLASSES, ConnectedStudent } from '../../types/classroom-share';

interface TeacherSharePanelProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
}

export function TeacherSharePanel({ isOpen, onClose, documentTitle }: TeacherSharePanelProps) {
  const { state, connectedStudents, startSharing, stopSharing } = useClassroomShare();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [showClassSelector, setShowClassSelector] = useState(true);
  const [notifications, setNotifications] = useState<string[]>([]);
  const previousStudentsRef = useRef<ConnectedStudent[]>([]);

  const { isSharing, currentSession } = state;

  // Track when students become inactive and show notifications
  useEffect(() => {
    if (!isSharing) return;

    const previousStudents = previousStudentsRef.current;
    
    connectedStudents.forEach(student => {
      const prev = previousStudents.find(s => s.id === student.id);
      if (prev && prev.isActive && !student.isActive) {
        // Student just became inactive
        setNotifications(n => [...n, `${student.name} se dívá jinam`]);
        setTimeout(() => {
          setNotifications(n => n.slice(1));
        }, 5000);
      }
    });

    previousStudentsRef.current = connectedStudents;
  }, [connectedStudents, isSharing]);

  const handleStartSharing = () => {
    if (!selectedClass) return;
    
    const classInfo = MOCK_CLASSES.find(c => c.id === selectedClass);
    if (classInfo) {
      startSharing(
        selectedClass,
        classInfo.name,
        window.location.pathname,
        documentTitle
      );
      setShowClassSelector(false);
    }
  };

  const handleStopSharing = () => {
    stopSharing();
    setShowClassSelector(true);
    setConnectedStudents([]);
  };

  const activeStudents = connectedStudents.filter(s => s.isActive).length;
  const inactiveStudents = connectedStudents.filter(s => !s.isActive);

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className={`w-5 h-5 ${isSharing ? 'text-red-400 animate-pulse' : 'text-white/70'}`} />
          <span className="font-semibold">Sdílení ve třídě</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <button
            onClick={() => setShowClassSelector(!showClassSelector)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-600 hover:bg-slate-500 transition-colors"
          >
            <span className="font-medium">
              {isSharing && currentSession ? `Třída ${currentSession.className}` : 'Připojit studenty'}
            </span>
            {showClassSelector ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showClassSelector && !isSharing && (
            <div className="mt-3 space-y-2">
              {MOCK_CLASSES.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    selectedClass === cls.id
                      ? 'bg-emerald-500/30 border border-emerald-400'
                      : 'bg-slate-700/50 hover:bg-slate-600/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white/70" />
                    <span>{cls.name}</span>
                  </div>
                  <span className="text-sm text-white/60">{cls.studentCount} žáků</span>
                </button>
              ))}
              
              {selectedClass && (
                <button
                  onClick={handleStartSharing}
                  className="w-full mt-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-white"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <Radio className="w-5 h-5" />
                  Začít živé vysílání
                </button>
              )}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="px-4 space-y-2">
            {notifications.map((notif, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/20 border border-orange-400/30 text-orange-200 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{notif}</span>
              </div>
            ))}
          </div>
        )}

        {isSharing && currentSession && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Studenti</h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{connectedStudents.length}</span>
                <Users className="w-5 h-5 text-white/70" />
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Eye className="w-4 h-4" />
                <span>{activeStudents} sleduje</span>
              </div>
              {inactiveStudents.length > 0 && (
                <div className="flex items-center gap-1.5 text-orange-400">
                  <EyeOff className="w-4 h-4" />
                  <span>{inactiveStudents.length} nesoustředí se</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              {connectedStudents.map((student) => (
                <div
                  key={student.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg transition-all ${
                    student.isActive ? 'text-white/90' : 'bg-orange-500/20 border border-orange-400/30 text-orange-200'
                  }`}
                >
                  <span className="font-medium">{student.name}</span>
                  {!student.isActive && <AlertTriangle className="w-4 h-4 text-orange-400" />}
                </div>
              ))}
            </div>

            {connectedStudents.length === 0 && (
              <div className="text-center text-white/50 py-8">
                <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Čekám na připojení studentů...</p>
                <p className="text-sm mt-1">Studenti se připojí automaticky</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isSharing && (
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleStopSharing}
            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300"
          >
            <Square className="w-4 h-4" />
            Ukončit sdílení
          </button>
        </div>
      )}
    </div>
  );
}

