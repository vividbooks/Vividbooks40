import React from 'react';

export const COLOR_GRID = {
  grays: ['transparent', '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#1e293b', '#0f172a'],
  colors: [
    '#7f1d1d', '#b91c1c', '#166534', '#0f766e', '#0369a1', '#1d4ed8', '#6d28d9', '#a21caf',
    '#dc2626', '#ef4444', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef',
    '#fca5a5', '#fecaca', '#86efac', '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f0abfc',
    '#fee2e2', '#fef2f2', '#dcfce7', '#ccfbf1', '#e0f2fe', '#dbeafe', '#ede9fe', '#fae8ff',
  ],
};

interface InlineColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

export function InlineColorPicker({ value, onChange }: InlineColorPickerProps) {
  const selectedColor = value || '#ffffff';

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_GRID.grays.map((color, idx) => (
          <button
            key={`gray-${idx}`}
            onClick={() => onChange(color === 'transparent' ? '#ffffff' : color)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
            }`}
            style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
          >
            {color === 'transparent' && (
              <div className="w-full h-full rounded-full relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-0.5 bg-red-400 rotate-45" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-8 gap-1.5">
        {COLOR_GRID.colors.map((color, idx) => (
          <button
            key={`color-${idx}`}
            onClick={() => onChange(color)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
