/**
 * ProSettingsPanel - Dark mode settings panel for PRO editor
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Worksheet, Subject, Grade } from '../../types/worksheet';
import {
  SIDEBAR_COLORS,
  sidebarContentStyle,
  sectionTitleStyle,
  sectionHeaderRowStyle,
  subtleCardStyle,
  inputStyle,
  textareaStyle,
  selectStyle,
  labelStyle,
  buttonStyle,
  iconButtonStyle,
  getSegmentedButtonStyle,
} from './block-settings/shared';

interface ProSettingsPanelProps {
  worksheet: Worksheet;
  onUpdateWorksheet: (updates: Partial<Worksheet>) => void;
}

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'matematika', label: 'Matematika' },
  { value: 'fyzika', label: 'Fyzika' },
  { value: 'chemie', label: 'Chemie' },
  { value: 'prirodopis', label: 'Přírodověda' },
  { value: 'cestina', label: 'Český jazyk' },
  { value: 'anglictina', label: 'Angličtina' },
  { value: 'dejepis', label: 'Dějepis' },
  { value: 'zemepis', label: 'Zeměpis' },
  { value: 'other', label: 'Jiný' },
];

const GRADES: Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function ProSettingsPanel({ worksheet, onUpdateWorksheet }: ProSettingsPanelProps) {
  const [keywordInput, setKeywordInput] = useState('');

  const addKeyword = () => {
    if (keywordInput.trim() && !worksheet.metadata.keywords?.includes(keywordInput.trim())) {
      onUpdateWorksheet({
        metadata: {
          ...worksheet.metadata,
          keywords: [...(worksheet.metadata.keywords || []), keywordInput.trim()],
        },
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    onUpdateWorksheet({
      metadata: {
        ...worksheet.metadata,
        keywords: (worksheet.metadata.keywords || []).filter(k => k !== keyword),
      },
    });
  };

  return (
    <div style={{ 
      backgroundColor: '#1e293b',
      height: '100%',
    }}>
      <div style={sidebarContentStyle}>
      <div style={{ ...sectionHeaderRowStyle, marginBottom: '16px' }}>
        <span style={sectionTitleStyle}>Nastavení listu</span>
      </div>

      {/* Title */}
      <div style={{ ...subtleCardStyle, marginBottom: '16px' }}>
        <label style={labelStyle}>Název</label>
        <input
          type="text"
          value={worksheet.title}
          onChange={(e) => onUpdateWorksheet({ title: e.target.value })}
          placeholder="Název pracovního listu"
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div style={{ ...subtleCardStyle, marginBottom: '16px' }}>
        <label style={labelStyle}>Popis</label>
        <textarea
          value={worksheet.metadata.description || ''}
          onChange={(e) => onUpdateWorksheet({ 
            metadata: { ...worksheet.metadata, description: e.target.value } 
          })}
          placeholder="Krátký popis..."
          rows={3}
          style={textareaStyle}
        />
      </div>

      {/* Subject */}
      <div style={{ ...subtleCardStyle, marginBottom: '16px' }}>
        <label style={labelStyle}>Předmět</label>
        <select
          value={worksheet.metadata.subject || ''}
          onChange={(e) => onUpdateWorksheet({ 
            metadata: { ...worksheet.metadata, subject: e.target.value as Subject } 
          })}
          style={selectStyle}
        >
          <option value="">Vyberte předmět</option>
          {SUBJECTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Grade */}
      <div style={{ ...subtleCardStyle, marginBottom: '16px' }}>
        <label style={labelStyle}>Ročník</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {GRADES.map((grade) => (
            <button
              key={grade}
              onClick={() => onUpdateWorksheet({ 
                metadata: { ...worksheet.metadata, grade } 
              })}
              style={{
                ...buttonStyle,
                ...getSegmentedButtonStyle(worksheet.metadata.grade === grade),
                fontSize: '11px',
              }}
            >
              {grade}.
            </button>
          ))}
        </div>
      </div>

      {/* Time */}
      <div style={{ ...subtleCardStyle, marginBottom: '16px' }}>
        <label style={labelStyle}>Časová náročnost (min)</label>
        <input
          type="number"
          value={worksheet.metadata.estimatedTime || ''}
          onChange={(e) => onUpdateWorksheet({ 
            metadata: { ...worksheet.metadata, estimatedTime: parseInt(e.target.value) || undefined } 
          })}
          placeholder="např. 15"
          min={1}
          max={180}
          style={{ ...inputStyle, width: '100px' }}
        />
      </div>

      {/* Keywords */}
      <div style={{ ...subtleCardStyle, marginBottom: '16px' }}>
        <label style={labelStyle}>Klíčová slova</label>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Přidat klíčové slovo"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={addKeyword}
            style={iconButtonStyle}
          >
            <Plus size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {(worksheet.metadata.keywords || []).map((keyword) => (
            <span
              key={keyword}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                backgroundColor: SIDEBAR_COLORS.panelSoft,
                borderRadius: '6px',
                fontSize: '11px',
                color: SIDEBAR_COLORS.text,
              }}
            >
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#808080',
                  display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
