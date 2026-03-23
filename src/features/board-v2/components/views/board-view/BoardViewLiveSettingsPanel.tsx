import type { ComponentType } from 'react';
import { ArrowLeft, Users } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

interface BoardViewLiveSettingsPanelProps {
  loadingClasses: boolean;
  availableClasses: ClassOption[];
  selectedClassId: string | null;
  onSelectedClassChange: (value: string | null) => void;
  liveShowSolutionHints: boolean;
  onLiveShowSolutionHintsChange: (value: boolean) => void;
  isStartingSession: boolean;
  onClose: () => void;
  onStart: () => void;
  ToggleSwitchComponent: ComponentType<ToggleSwitchProps>;
}

export function BoardViewLiveSettingsPanel({
  loadingClasses,
  availableClasses,
  selectedClassId,
  onSelectedClassChange,
  liveShowSolutionHints,
  onLiveShowSolutionHintsChange,
  isStartingSession,
  onClose,
  onStart,
  ToggleSwitchComponent,
}: BoardViewLiveSettingsPanelProps) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#4a5568' }}>
      <div className="p-4">
        <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white mb-4">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-white text-center mb-2">Živé promítání</h2>
        <p className="text-white/60 text-center text-sm">Nastavení relace</p>
      </div>

      <div className="flex-1 px-6 flex flex-col overflow-y-auto">
        <div className="mt-4">
          <label className="text-white font-medium block mb-2">
            <Users className="w-4 h-4 inline-block mr-2" />
            Připojit třídu (volitelné)
          </label>
          {loadingClasses ? (
            <div className="text-white/50 text-sm py-3">Načítám třídy...</div>
          ) : availableClasses.length === 0 ? (
            <div className="text-white/50 text-sm py-3">Žádné třídy k dispozici</div>
          ) : (
            <select
              value={selectedClassId || ''}
              onChange={(e) => onSelectedClassChange(e.target.value || null)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 outline-none"
            >
              <option value="" className="text-slate-800">Bez třídy (veřejná relace)</option>
              {availableClasses.map(cls => (
                <option key={cls.id} value={cls.id} className="text-slate-800">
                  {cls.name}
                </option>
              ))}
            </select>
          )}
          <p className="text-white/50 text-xs pl-1 pt-2 pb-3">
            Připojením třídy budou výsledky automaticky přiřazeny studentům.
          </p>
        </div>

        <div className="space-y-1 mt-4">
          <ToggleSwitchComponent
            enabled={liveShowSolutionHints}
            onChange={onLiveShowSolutionHintsChange}
            label="Zobrazit řešení a nápovědu"
          />
          <p className="text-white/50 text-xs pl-1 pb-3">
            Při špatné odpovědi se ukáže správná odpověď. Pokud má otázka nápovědu, zobrazí se tlačítko.
          </p>
        </div>

        <div className="mt-auto pb-6">
          <button
            onClick={onStart}
            disabled={isStartingSession}
            className="w-full py-5 rounded-xl font-bold text-xl transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#e8f84a', color: '#1e293b' }}
          >
            {isStartingSession ? 'Spouštím...' : 'Spustit promítání'}
          </button>
        </div>
      </div>
    </div>
  );
}
