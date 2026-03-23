import { BarChart2 } from 'lucide-react';

interface BoardViewEndSessionDialogProps {
  onEndAndShowResults: () => void;
  onEndWithoutResults: () => void;
  onCancel: () => void;
}

export function BoardViewEndSessionDialog({
  onEndAndShowResults,
  onEndWithoutResults,
  onCancel,
}: BoardViewEndSessionDialogProps) {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Ukončit session?</h3>
        <p className="text-slate-500 text-sm mb-6">
          Session bude ukončena a studenti budou odpojeni.
        </p>
        <div className="space-y-2">
          <button
            onClick={onEndAndShowResults}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2"
          >
            <BarChart2 className="w-4 h-4" />
            Ukončit a zobrazit výsledky
          </button>
          <button
            onClick={onEndWithoutResults}
            className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
          >
            Ukončit bez výsledků
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
