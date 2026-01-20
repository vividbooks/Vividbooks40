import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Settings, Plus, Trash2, X, Check } from 'lucide-react';

interface TableEditorProps {
  editor: Editor;
  isVisible: boolean;
  onClose: () => void;
}

interface TableSettings {
  headerBg: string;
  cellBg: string;
  borderColor: string;
  borderWidth: number;
}

const colorPresets = [
  { name: 'Světle modrá', headerBg: '#dbeafe', cellBg: '#ffffff', borderColor: '#93c5fd' },
  { name: 'Světle zelená', headerBg: '#dcfce7', cellBg: '#ffffff', borderColor: '#86efac' },
  { name: 'Světle fialová', headerBg: '#f3e8ff', cellBg: '#ffffff', borderColor: '#d8b4fe' },
  { name: 'Světle oranžová', headerBg: '#ffedd5', cellBg: '#ffffff', borderColor: '#fdba74' },
  { name: 'Světle šedá', headerBg: '#f1f5f9', cellBg: '#ffffff', borderColor: '#e2e8f0' },
  { name: 'Tmavě modrá', headerBg: '#1e40af', cellBg: '#eff6ff', borderColor: '#1e40af' },
];

export function TableEditorOverlay({ editor, isVisible, onClose }: TableEditorProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TableSettings>({
    headerBg: '#f1f5f9',
    cellBg: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
  });

  if (!isVisible || !editor.isActive('table')) return null;

  const applySettings = () => {
    // Apply CSS variables to the table
    const tableElement = document.querySelector('.tiptap-editor table') as HTMLElement;
    if (tableElement) {
      tableElement.style.setProperty('--table-header-bg', settings.headerBg);
      tableElement.style.setProperty('--table-cell-bg', settings.cellBg);
      tableElement.style.setProperty('--table-border-color', settings.borderColor);
      tableElement.style.borderWidth = `${settings.borderWidth}px`;
    }
    setShowSettings(false);
  };

  const applyPreset = (preset: typeof colorPresets[0]) => {
    setSettings({
      ...settings,
      headerBg: preset.headerBg,
      cellBg: preset.cellBg,
      borderColor: preset.borderColor,
    });
    
    const tableElement = document.querySelector('.tiptap-editor table') as HTMLElement;
    if (tableElement) {
      tableElement.style.setProperty('--table-header-bg', preset.headerBg);
      tableElement.style.setProperty('--table-cell-bg', preset.cellBg);
      tableElement.style.setProperty('--table-border-color', preset.borderColor);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-700">Úprava tabulky</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded text-slate-500"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Controls */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Row Controls */}
        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
          <span className="text-xs text-slate-500 px-2">Řádky:</span>
          <button
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="p-1.5 hover:bg-white rounded text-slate-600 transition-colors flex items-center gap-1"
            title="Přidat řádek nad"
          >
            <Plus size={14} />
            <span className="text-xs">Nad</span>
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="p-1.5 hover:bg-white rounded text-slate-600 transition-colors flex items-center gap-1"
            title="Přidat řádek pod"
          >
            <Plus size={14} />
            <span className="text-xs">Pod</span>
          </button>
          <button
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"
            title="Smazat řádek"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Column Controls */}
        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
          <span className="text-xs text-slate-500 px-2">Sloupce:</span>
          <button
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="p-1.5 hover:bg-white rounded text-slate-600 transition-colors flex items-center gap-1"
            title="Přidat sloupec vlevo"
          >
            <Plus size={14} />
            <span className="text-xs">Vlevo</span>
          </button>
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="p-1.5 hover:bg-white rounded text-slate-600 transition-colors flex items-center gap-1"
            title="Přidat sloupec vpravo"
          >
            <Plus size={14} />
            <span className="text-xs">Vpravo</span>
          </button>
          <button
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"
            title="Smazat sloupec"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Header Toggle */}
        <button
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            editor.isActive('tableHeader') 
              ? 'bg-blue-500 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Záhlaví
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-lg transition-colors ${
            showSettings ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title="Nastavení barev"
        >
          <Settings size={16} />
        </button>

        {/* Delete Table */}
        <button
          onClick={() => {
            editor.chain().focus().deleteTable().run();
            onClose();
          }}
          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors flex items-center gap-1 ml-auto"
          title="Smazat tabulku"
        >
          <Trash2 size={16} />
          <span className="text-xs">Smazat tabulku</span>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-t border-slate-200 pt-3 mt-2">
          <div className="mb-3">
            <span className="text-xs font-medium text-slate-600 mb-2 block">Barevné šablony:</span>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-slate-200 hover:border-blue-400 transition-colors"
                  title={preset.name}
                >
                  <div 
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: preset.headerBg, borderColor: preset.borderColor }}
                  />
                  <span className="text-xs text-slate-600">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Záhlaví</label>
              <input
                type="color"
                value={settings.headerBg}
                onChange={(e) => setSettings({ ...settings, headerBg: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Buňky</label>
              <input
                type="color"
                value={settings.cellBg}
                onChange={(e) => setSettings({ ...settings, cellBg: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ohraničení</label>
              <input
                type="color"
                value={settings.borderColor}
                onChange={(e) => setSettings({ ...settings, borderColor: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tloušťka ({settings.borderWidth}px)</label>
              <input
                type="range"
                min="1"
                max="4"
                value={settings.borderWidth}
                onChange={(e) => setSettings({ ...settings, borderWidth: parseInt(e.target.value) })}
                className="w-full h-8"
              />
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button
              onClick={applySettings}
              className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <Check size={14} />
              Použít
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick add buttons that appear around the table
export function TableQuickActions({ editor }: { editor: Editor }) {
  if (!editor.isActive('table')) return null;

  return (
    <>
      {/* Add Row Button - appears below table on hover */}
      <div className="flex justify-center mt-1 opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 text-xs transition-colors"
        >
          <Plus size={12} />
          Přidat řádek
        </button>
      </div>
    </>
  );
}


