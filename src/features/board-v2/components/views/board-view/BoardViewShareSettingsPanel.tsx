import type { ComponentType } from 'react';
import { ArrowLeft } from 'lucide-react';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

interface BoardViewShareSettingsPanelProps {
  shareLink: string | null;
  sessionName: string;
  anonymousAccess: boolean;
  showSolutionHints: boolean;
  showActivityResults: boolean;
  requireAnswerToProgress: boolean;
  showNotes: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onResetShareLink: () => void;
  onSessionNameChange: (value: string) => void;
  onAnonymousAccessChange: (value: boolean) => void;
  onShowSolutionHintsChange: (value: boolean) => void;
  onShowActivityResultsChange: (value: boolean) => void;
  onRequireAnswerToProgressChange: (value: boolean) => void;
  onShowNotesChange: (value: boolean) => void;
  onStartSharing: () => void;
  ToggleSwitchComponent: ComponentType<ToggleSwitchProps>;
}

export function BoardViewShareSettingsPanel({
  shareLink,
  sessionName,
  anonymousAccess,
  showSolutionHints,
  showActivityResults,
  requireAnswerToProgress,
  showNotes,
  onClose,
  onCopyLink,
  onResetShareLink,
  onSessionNameChange,
  onAnonymousAccessChange,
  onShowSolutionHintsChange,
  onShowActivityResultsChange,
  onRequireAnswerToProgressChange,
  onShowNotesChange,
  onStartSharing,
  ToggleSwitchComponent,
}: BoardViewShareSettingsPanelProps) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#4a5568' }}>
      <div className="p-4">
        <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white mb-4">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-white text-center mb-6">Nastavení</h2>
      </div>

      {shareLink ? (
        <div className="flex-1 px-6 flex flex-col">
          <div className="bg-white/10 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-300 mb-2">Odkaz pro studenty:</p>
            <p className="text-white font-mono text-sm break-all">{shareLink}</p>
          </div>
          <button
            onClick={onCopyLink}
            className="w-full py-4 rounded-xl bg-emerald-400 text-slate-900 font-bold text-lg hover:bg-emerald-300 transition-colors mb-4"
          >
            Kopírovat odkaz
          </button>
          <button
            onClick={onResetShareLink}
            className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
          >
            Upravit nastavení
          </button>
        </div>
      ) : (
        <div className="flex-1 px-6 flex flex-col">
          <div className="mb-6">
            <label className="text-white font-medium mb-2 block">Jméno relace</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => onSessionNameChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-emerald-400"
              placeholder="Nová relace"
            />
          </div>

          <div className="space-y-1">
            <ToggleSwitchComponent enabled={anonymousAccess} onChange={onAnonymousAccessChange} label="Anonymní přístup (bez jména)" />
            <ToggleSwitchComponent enabled={showSolutionHints} onChange={onShowSolutionHintsChange} label="Ověřit řešení a zobrazit nápovědu" />
            <ToggleSwitchComponent enabled={showActivityResults} onChange={onShowActivityResultsChange} label="Zobrazovat vyhodnocení aktivit" />
            <ToggleSwitchComponent enabled={requireAnswerToProgress} onChange={onRequireAnswerToProgressChange} label="Vyžadovat odpověď pro posunutí" />
            <ToggleSwitchComponent enabled={showNotes} onChange={onShowNotesChange} label="Zobrazit poznámky" />
          </div>

          <div className="mt-auto pb-6">
            <button
              onClick={onStartSharing}
              className="w-full py-5 rounded-xl bg-emerald-400 text-slate-900 font-bold text-xl hover:bg-emerald-300 transition-colors"
            >
              Zahájit sdílení
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
