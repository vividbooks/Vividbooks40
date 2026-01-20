import React, { useState, useEffect } from 'react';
import { WorksheetData, PracticeLink, LinkItem } from '../../types/worksheet';
import { Plus, Trash2, GripVertical, ExternalLink } from 'lucide-react';

interface WorksheetEditorProps {
  data: WorksheetData;
  onChange: (data: WorksheetData) => void;
}

export function WorksheetEditor({ data, onChange }: WorksheetEditorProps) {
  const updateField = (field: keyof WorksheetData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const addPractice = () => {
    const newPractice: PracticeLink = {
      id: crypto.randomUUID(),
      label: '',
      url: '',
      level: 1
    };
    updateField('exercises', [...data.exercises, newPractice]);
  };

  const updatePractice = (id: string, field: keyof PracticeLink, value: any) => {
    const updated = data.exercises.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    updateField('exercises', updated);
  };

  const removePractice = (id: string) => {
    updateField('exercises', data.exercises.filter(item => item.id !== id));
  };

  const addLinkItem = (field: 'minigames' | 'tests' | 'exams' | 'bonuses') => {
    const newItem: LinkItem = {
      id: crypto.randomUUID(),
      label: '',
      url: ''
    };
    updateField(field, [...data[field], newItem]);
  };

  const updateLinkItem = (field: 'minigames' | 'tests' | 'exams' | 'bonuses', id: string, key: keyof LinkItem, value: string) => {
    const updated = data[field].map(item => 
      item.id === id ? { ...item, [key]: value } : item
    );
    updateField(field, updated);
  };

  const removeLinkItem = (field: 'minigames' | 'tests' | 'exams' | 'bonuses', id: string) => {
    updateField(field, data[field].filter(item => item.id !== id));
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-medium text-lg border-b pb-2">Základní soubory</h3>
          
          <div>
            <label className="block text-sm font-medium mb-1">Náhled pracovního listu (Obrázek URL)</label>
            <input
              type="text"
              value={data.previewUrl}
              onChange={(e) => updateField('previewUrl', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="https://..."
            />
            {data.previewUrl && (
              <div className="mt-2 border rounded p-1 bg-muted/20 w-32">
                <img src={data.previewUrl} alt="Náhled" className="w-full h-auto rounded" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Odkaz na PDF (Otevřít PDF)</label>
            <input
              type="text"
              value={data.pdfUrl}
              onChange={(e) => updateField('pdfUrl', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Odkaz na řešení (Řešení PDF)</label>
            <input
              type="text"
              value={data.solutionPdfUrl}
              onChange={(e) => updateField('solutionPdfUrl', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Interaktivní pracovní list (Odkaz)</label>
            <input
              type="text"
              value={data.interactiveUrl}
              onChange={(e) => updateField('interactiveUrl', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Odkaz na Učební text</label>
            <input
              type="text"
              value={data.textbookUrl}
              onChange={(e) => updateField('textbookUrl', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Odkaz na Metodiku</label>
            <input
              type="text"
              value={data.methodologyUrl}
              onChange={(e) => updateField('methodologyUrl', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="space-y-4">
           <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
             <h4 className="text-amber-800 font-medium mb-2">Nápověda</h4>
             <p className="text-sm text-amber-700">
               Tyto odkazy se zobrazí na stránce v sekci "Další možnosti". 
               Procvičování, testy a minihry spravujte níže.
             </p>
           </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-medium text-lg">Procvičování</h3>
          <button
            onClick={addPractice}
            type="button"
            className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20"
          >
            <Plus className="h-4 w-4" /> Přidat procvičování
          </button>
        </div>

        {data.exercises.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">Žádné procvičování.</p>
        ) : (
          <div className="space-y-3">
            {data.exercises.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0 cursor-grab" />
                <div className="flex-1 grid gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updatePractice(item.id, 'label', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        placeholder="Název (např. Pokročilé převody jednotek 1)"
                      />
                    </div>
                    <div>
                      <select
                        value={item.level}
                        onChange={(e) => updatePractice(item.id, 'level', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                      >
                        <option value={1}>Úroveň 1 (Žlutá)</option>
                        <option value={2}>Úroveň 2 (Modrá)</option>
                        <option value={3}>Úroveň 3 (Červená)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={item.url}
                      onChange={(e) => updatePractice(item.id, 'url', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono text-muted-foreground"
                      placeholder="https://..."
                    />
                    <button
                      onClick={() => removePractice(item.id)}
                      type="button"
                      className="p-2 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SimpleLinkList 
        title="Procvičovací minihry" 
        items={data.minigames} 
        onAdd={() => addLinkItem('minigames')}
        onUpdate={(id, k, v) => updateLinkItem('minigames', id, k, v)}
        onRemove={(id) => removeLinkItem('minigames', id)}
      />

      <SimpleLinkList 
        title="Testy" 
        items={data.tests} 
        onAdd={() => addLinkItem('tests')}
        onUpdate={(id, k, v) => updateLinkItem('tests', id, k, v)}
        onRemove={(id) => removeLinkItem('tests', id)}
      />

      <SimpleLinkList 
        title="Písemky" 
        items={data.exams} 
        onAdd={() => addLinkItem('exams')}
        onUpdate={(id, k, v) => updateLinkItem('exams', id, k, v)}
        onRemove={(id) => removeLinkItem('exams', id)}
      />

      <SimpleLinkList 
        title="Bonusy" 
        items={data.bonuses} 
        onAdd={() => addLinkItem('bonuses')}
        onUpdate={(id, k, v) => updateLinkItem('bonuses', id, k, v)}
        onRemove={(id) => removeLinkItem('bonuses', id)}
      />
    </div>
  );
}

interface SimpleLinkListProps {
  title: string;
  items: LinkItem[];
  onAdd: () => void;
  onUpdate: (id: string, key: keyof LinkItem, value: string) => void;
  onRemove: (id: string) => void;
}

function SimpleLinkList({ title, items, onAdd, onUpdate, onRemove }: SimpleLinkListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-medium text-lg">{title}</h3>
        <button
          onClick={onAdd}
          type="button"
          className="flex items-center gap-1 text-sm bg-secondary text-secondary-foreground px-3 py-1.5 rounded hover:bg-secondary/80"
        >
          <Plus className="h-4 w-4" /> Přidat položku
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">Žádné položky.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 cursor-grab" />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => onUpdate(item.id, 'label', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="Název"
                />
                <input
                  type="text"
                  value={item.url}
                  onChange={(e) => onUpdate(item.id, 'url', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono text-muted-foreground"
                  placeholder="https://..."
                />
              </div>
              <button
                onClick={() => onRemove(item.id)}
                type="button"
                className="p-2 text-destructive hover:bg-destructive/10 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
