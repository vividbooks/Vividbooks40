import type { ReactNode } from 'react';
import { CheckCircle, Copy, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ClassroomStudentState {
  studentName?: string;
  isOnline?: boolean;
  isFocused?: boolean;
  completedAt?: string;
}

interface BoardViewClassroomPanelProps {
  classroomStarted: boolean;
  classroomStudents: Record<string, ClassroomStudentState>;
  classroomShareCode: string | null;
  classroomShareLink: string | null;
  copied: boolean;
  onOpenQrPopup: (mode: 'qr' | 'code') => void;
  onCopyLink: (text: string) => void;
  onOpenEndDialog: () => void;
  showEndDialog: boolean;
  endDialog?: ReactNode;
}

export function BoardViewClassroomPanel({
  classroomStarted,
  classroomStudents,
  classroomShareCode,
  classroomShareLink,
  copied,
  onOpenQrPopup,
  onCopyLink,
  onOpenEndDialog,
  showEndDialog,
  endDialog,
}: BoardViewClassroomPanelProps) {
  const classroomOnline = Object.values(classroomStudents).filter((s) => s.isOnline);
  const classroomCompleted = Object.values(classroomStudents).filter((s) => s.completedAt);
  const classroomDistracted = Object.values(classroomStudents).filter((s) => s.isOnline && s.isFocused === false);
  const classroomTotal = Object.keys(classroomStudents).length;
  const classroomJoinLink = classroomShareLink || '';

  if (!classroomStarted) {
    return (
      <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #334155' }}>
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#334155' }}>
            <Users className="w-5 h-5" style={{ color: '#94a3b8' }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: '#64748b' }}>Režim:</p>
              <p className="text-sm font-medium" style={{ color: '#ffffff' }}>Zadáno ve výuce</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2" style={{ color: '#94a3b8' }}>
              <Users className="w-4 h-4" />
              <span className="text-sm">Připojení studenti</span>
            </div>
            <span className="font-bold" style={{ color: '#ffffff' }}>{classroomTotal}</span>
          </div>

          {classroomTotal === 0 ? (
            <div className="text-center py-8" style={{ color: '#64748b' }}>
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Čekám na studenty...</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {Object.values(classroomStudents).map((student, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white truncate">{student.studentName || 'Student'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4" style={{ borderTop: '1px solid #334155' }}>
          <button
            onClick={onOpenEndDialog}
            className="w-full py-2 rounded-xl text-sm text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
          >
            Zrušit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #334155' }}>
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#334155' }}>
          <Users className="w-5 h-5" style={{ color: '#94a3b8' }} />
          <div className="text-left">
            <p className="text-xs" style={{ color: '#64748b' }}>Režim:</p>
            <p className="text-sm font-medium" style={{ color: '#ffffff' }}>Zadáno ve výuce</p>
          </div>
        </div>
      </div>

      <div className="p-4" style={{ borderBottom: '1px solid #334155' }}>
        <div className="text-center mb-3">
          <span className="text-white/70 text-xl">Kód: </span>
          <span className="text-yellow-400 text-xl font-bold tracking-wider">{classroomShareCode}</span>
        </div>
        <div className="flex justify-center mb-3 cursor-pointer transition-all group" onClick={() => onOpenQrPopup('qr')}>
          <div className="bg-white p-3 rounded-xl transition-all group-hover:ring-4 group-hover:ring-orange-400">
            <QRCodeSVG value={classroomJoinLink} size={180} level="M" />
          </div>
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => onCopyLink(classroomJoinLink)}
            className="py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#1e293b', width: '206px' }}
          >
            {copied ? (
              <><CheckCircle className="w-4 h-4" /><span>Zkopírováno!</span></>
            ) : (
              <><Copy className="w-4 h-4" /><span>Kopírovat odkaz</span></>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2" style={{ color: '#94a3b8' }}>
            <Users className="w-4 h-4" />
            <span className="text-sm">Připojení studenti</span>
          </div>
          <span className="font-bold" style={{ color: '#ffffff' }}>{classroomTotal}</span>
        </div>

        <div className="rounded-xl p-3" style={{ backgroundColor: '#334155' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              Online
            </span>
            <span className="text-xs font-bold text-emerald-400">{classroomOnline.length}</span>
          </div>
          {classroomDistracted.length > 0 && (
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                Rozptýlení
              </span>
              <span className="text-xs font-bold text-amber-400">{classroomDistracted.length}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              Dokončili
            </span>
            <span className="text-xs font-bold text-blue-400">{classroomCompleted.length}</span>
          </div>
        </div>
      </div>

      <div className="p-4" style={{ borderTop: '1px solid #334155' }}>
        <button
          onClick={onOpenEndDialog}
          className="w-full py-3 rounded-xl font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors border border-red-500/30"
        >
          Ukončit výuku
        </button>
      </div>

      {showEndDialog && endDialog}
    </div>
  );
}
