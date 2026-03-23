import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface StudentOption {
  key: string;
  label: string;
  section: 'together' | 'solo';
  accent: string;
  desc: string;
  icon: ReactNode;
}

interface BoardViewStudentOptionsPanelProps {
  studentOptions: StudentOption[];
  hoveredStudentOption: string | null;
  setHoveredStudentOption: (value: string | null) => void;
  onClose: () => void;
  onProjection: () => void;
  onCompetition: () => void;
  onPresent: () => void;
  onClassroom: () => void;
  onShare: () => void;
}

export function BoardViewStudentOptionsPanel({
  studentOptions,
  hoveredStudentOption,
  setHoveredStudentOption,
  onClose,
  onProjection,
  onCompetition,
  onPresent,
  onClassroom,
  onShare,
}: BoardViewStudentOptionsPanelProps) {
  const optionHandlers: Record<string, () => void> = {
    projection: onProjection,
    competition: onCompetition,
    present: onPresent,
    classroom: onClassroom,
    share: onShare,
  };

  const renderOption = (opt: StudentOption) => {
    const isHovered = hoveredStudentOption === opt.key;

    return (
      <div key={opt.key} className="mb-3">
        <button
          onClick={optionHandlers[opt.key]}
          onMouseEnter={() => setHoveredStudentOption(opt.key)}
          onMouseLeave={() => setHoveredStudentOption(null)}
          onFocus={() => setHoveredStudentOption(opt.key)}
          onBlur={() => setHoveredStudentOption(null)}
          className="w-full rounded-2xl text-left transition-all duration-200"
          style={{
            backgroundColor: isHovered ? `${opt.accent}20` : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isHovered ? `${opt.accent}66` : 'rgba(255,255,255,0.08)'}`,
            boxShadow: isHovered ? `0 12px 28px ${opt.accent}18` : 'none',
          }}
        >
          <div className="flex items-center gap-4 px-5 py-4">
            <div
              className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ backgroundColor: isHovered ? `${opt.accent}26` : `${opt.accent}16` }}
            >
              {opt.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-white leading-snug">{opt.label}</div>
              <div
                className="overflow-hidden transition-all duration-200"
                style={{
                  maxHeight: isHovered ? '80px' : '0px',
                  opacity: isHovered ? 1 : 0,
                  marginTop: isHovered ? '8px' : '0px',
                }}
              >
                <p className="text-sm leading-6 text-slate-200 pr-2">{opt.desc}</p>
              </div>
            </div>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zpět</span>
        </button>
        <h2 className="text-lg font-bold text-white leading-snug">Jak zapojit studenty?</h2>
        <p className="text-xs text-slate-400 mt-0.5">Vyber režim, který nejlépe sedí tomu, jak chceš board spustit.</p>
      </div>

      <div className="flex-1 px-4 overflow-y-auto flex flex-col">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Společně</p>
        <div className="flex flex-col gap-1 mb-3">
          {studentOptions.filter(o => o.section === 'together').map(renderOption)}
        </div>

        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Každý sám</p>
        <div className="flex flex-col gap-1">
          {studentOptions.filter(o => o.section === 'solo').map(renderOption)}
        </div>

        <div className="mt-auto" />
      </div>

      <div className="p-5">
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl font-semibold transition-colors"
          style={{ backgroundColor: '#1a2236', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          Nezapojovat studenty
        </button>
      </div>
    </div>
  );
}
