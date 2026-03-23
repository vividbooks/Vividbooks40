/**
 * RAG Worksheet Library
 *
 * Správa knihovny vzorových pracovních listů pro RAG generování.
 * Sloupcové UX: levý panel = složky, pravý panel = listy ve složce.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Database,
  Star,
  StarOff,
  Loader2,
  Check,
  X,
  BookOpen,
  RefreshCw,
  Search,
  ChevronRight,
  FileText,
  Cpu,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { supabaseUrl, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Typy
// ─────────────────────────────────────────────────────────────────────────────

interface RagEntry {
  id: string;
  title: string;
  subject: string | null;
  grade: number | null;
  topic: string | null;
  quality_score: number;
  style_notes: string | null;
  source: string;
  folder: string;
  teacher_worksheet_id: string | null;
  created_at: string;
  embedding: boolean | null; // null = neznáme, true = má embedding, false = nemá
}

interface TeacherWorksheet {
  id: string;
  title: string;
  subject?: string;
  grade?: number;
  updated_at?: string;
}

const UNCATEGORIZED = 'Bez složky';

const SUBJECT_LABELS: Record<string, string> = {
  matematika: 'Matematika',
  dejepis: 'Dějepis',
  fyzika: 'Fyzika',
  chemie: 'Chemie',
  prirodopis: 'Přírodopis',
  cestina: 'Čeština',
  anglictina: 'Angličtina',
};

function subjectLabel(s: string | null) {
  if (!s) return '–';
  return SUBJECT_LABELS[s] || s;
}

function qualityColor(score: number) {
  if (score >= 0.8) return 'text-emerald-600 bg-emerald-50';
  if (score >= 0.6) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

// ─────────────────────────────────────────────────────────────────────────────
// Hlavní komponenta
// ─────────────────────────────────────────────────────────────────────────────

export function RAGWorksheetLibrary() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<RagEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>(UNCATEGORIZED);
  const [selectedEntry, setSelectedEntry] = useState<RagEntry | null>(null);

  // Inline rename folder
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Nová složka
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Přidání z teacher_worksheets
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerWorksheets, setPickerWorksheets] = useState<TeacherWorksheet[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Edit detailu
  const [editingEntry, setEditingEntry] = useState<RagEntry | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);

  // Embedding generation
  const [generatingEmbedding, setGeneratingEmbedding] = useState<string | null>(null);

  const generateEmbeddingForEntry = async (entry: RagEntry) => {
    setGeneratingEmbedding(entry.id);
    try {
      // Fetch full blocks_json for this entry
      const { data: fullEntry } = await supabase
        .from('worksheet_rag_examples')
        .select('blocks_json, topic, subject, grade, style_notes')
        .eq('id', entry.id)
        .single();

      const response = await fetch(
        `${supabaseUrl}/functions/v1/worksheet-rag-index`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
          },
          body: JSON.stringify({
            ragId: entry.id,
            topic: fullEntry?.topic || entry.topic,
            subject: fullEntry?.subject || entry.subject,
            grade: fullEntry?.grade || entry.grade,
            styleNotes: fullEntry?.style_notes || entry.style_notes,
            blocksJson: fullEntry?.blocks_json || [],
          }),
        }
      );
      const result = await response.json();
      if (result.success) {
        toast.success('Embedding vygenerován!');
        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, embedding: true } : e));
        if (selectedEntry?.id === entry.id) setSelectedEntry(prev => prev ? { ...prev, embedding: true } : prev);
      } else {
        toast.error(`Chyba: ${result.error || response.status}`);
      }
    } catch (err) {
      toast.error('Nepodařilo se vygenerovat embedding');
    } finally {
      setGeneratingEmbedding(null);
    }
  };

  const generateAllMissingEmbeddings = async () => {
    const missing = entries.filter(e => !e.embedding);
    if (!missing.length) { toast.info('Všechny listy mají embedding'); return; }
    toast.info(`Generuji embeddingy pro ${missing.length} listů...`);
    for (const entry of missing) {
      await generateEmbeddingForEntry(entry);
    }
    toast.success('Hotovo!');
  };

  // ── Data loading ──────────────────────────────────────────────────────────

  const [folderColumnExists, setFolderColumnExists] = useState(true);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Try with folder column first
      let data: any[] | null = null;
      let usedFolder = true;

      const res = await supabase
        .from('worksheet_rag_examples')
        .select('id, title, subject, grade, topic, quality_score, style_notes, source, folder, teacher_worksheet_id, created_at, embedding')
        .order('created_at', { ascending: false });

      if (res.error?.message?.includes('folder does not exist') || res.error?.message?.includes('column')) {
        // Fallback: query without folder + embedding columns
        usedFolder = false;
        setFolderColumnExists(false);
        const res2 = await supabase
          .from('worksheet_rag_examples')
          .select('id, title, subject, grade, topic, quality_score, style_notes, source, teacher_worksheet_id, created_at')
          .order('created_at', { ascending: false });
        if (res2.error) throw res2.error;
        data = res2.data;
      } else {
        if (res.error) throw res.error;
        data = res.data;
        setFolderColumnExists(true);
      }

      const normalized: RagEntry[] = (data || []).map((r: any) => ({
        ...r,
        folder: usedFolder ? (r.folder || UNCATEGORIZED) : UNCATEGORIZED,
        embedding: usedFolder ? (r.embedding !== null && r.embedding !== undefined) : null,
      }));

      setEntries(normalized);
    } catch (err: any) {
      toast.error('Chyba při načítání RAG databáze: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const folders = Array.from(new Set(entries.map(e => e.folder))).sort((a, b) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b, 'cs');
  });

  if (!folders.includes(selectedFolder) && folders.length > 0) {
    // Auto-select first if current selection gone
  }

  const folderEntries = entries.filter(e => e.folder === selectedFolder);

  // ── Folder operations ─────────────────────────────────────────────────────

  const handleAddFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.includes(name)) { toast.error('Složka již existuje'); return; }
    // Folder is "virtual" – we just update a first entry or keep as placeholder
    // We create a placeholder entry with empty blocks so folder appears
    const { error } = await supabase.from('worksheet_rag_examples').insert({
      title: '__folder_placeholder__',
      folder: name,
      blocks_json: [],
      quality_score: 0,
      source: 'folder',
    });
    if (error) { toast.error('Chyba: ' + error.message); return; }
    setNewFolderName('');
    setAddingFolder(false);
    setSelectedFolder(name);
    await loadEntries();
    toast.success(`Složka "${name}" vytvořena`);
  };

  const handleRenameFolder = async (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) { setRenamingFolder(null); return; }
    if (folders.includes(newName)) { toast.error('Složka již existuje'); return; }

    const { error } = await supabase
      .from('worksheet_rag_examples')
      .update({ folder: newName })
      .eq('folder', oldName);

    if (error) { toast.error('Chyba přejmenování: ' + error.message); return; }
    setRenamingFolder(null);
    if (selectedFolder === oldName) setSelectedFolder(newName);
    await loadEntries();
    toast.success('Složka přejmenována');
  };

  const handleDeleteFolder = async (folderName: string) => {
    const count = entries.filter(e => e.folder === folderName).length;
    const realCount = entries.filter(e => e.folder === folderName && e.source !== 'folder').length;
    const msg = realCount > 0
      ? `Složka "${folderName}" obsahuje ${realCount} pracovních listů. Smazat vše?`
      : `Smazat složku "${folderName}"?`;
    if (!confirm(msg)) return;

    const { error } = await supabase
      .from('worksheet_rag_examples')
      .delete()
      .eq('folder', folderName);

    if (error) { toast.error('Chyba mazání: ' + error.message); return; }
    if (selectedFolder === folderName) setSelectedFolder(folders.find(f => f !== folderName) || UNCATEGORIZED);
    await loadEntries();
    toast.success('Složka smazána');
  };

  // ── Entry operations ──────────────────────────────────────────────────────

  const handleDeleteEntry = async (entry: RagEntry) => {
    if (!confirm(`Odebrat "${entry.title}" z RAG databáze?`)) return;
    const { error } = await supabase
      .from('worksheet_rag_examples')
      .delete()
      .eq('id', entry.id);
    if (error) { toast.error('Chyba: ' + error.message); return; }
    if (selectedEntry?.id === entry.id) setSelectedEntry(null);
    await loadEntries();
    toast.success('Odebráno z RAG');
  };

  const handleSaveEntry = async () => {
    if (!editingEntry) return;
    setSavingEntry(true);
    try {
      const { error } = await supabase
        .from('worksheet_rag_examples')
        .update({
          title: editingEntry.title,
          subject: editingEntry.subject,
          grade: editingEntry.grade,
          topic: editingEntry.topic,
          quality_score: editingEntry.quality_score,
          style_notes: editingEntry.style_notes,
          folder: editingEntry.folder,
        })
        .eq('id', editingEntry.id);
      if (error) throw error;
      toast.success('Uloženo');
      setSelectedEntry(editingEntry);
      setEditingEntry(null);
      await loadEntries();
    } catch (err: any) {
      toast.error('Chyba: ' + err.message);
    } finally {
      setSavingEntry(false);
    }
  };

  // ── Worksheet picker ──────────────────────────────────────────────────────

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerSearch('');
    try {
      const { data, error } = await supabase
        .from('teacher_worksheets')
        .select('id, title, subject, grade, updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setPickerWorksheets(data || []);
    } catch (err: any) {
      toast.error('Chyba načítání listů: ' + err.message);
    } finally {
      setPickerLoading(false);
    }
  };

  const handlePickWorksheet = async (ws: TeacherWorksheet) => {
    // Check if already in RAG
    const alreadyIn = entries.find(e => e.teacher_worksheet_id === ws.id);
    if (alreadyIn) {
      toast.info(`Tento list je již v RAG (složka: ${alreadyIn.folder})`);
      return;
    }

    // Load full worksheet data to get blocks
    const { data: fullWs, error } = await supabase
      .from('teacher_worksheets')
      .select('blocks, title, subject, grade')
      .eq('id', ws.id)
      .single();

    if (error) { toast.error('Chyba načítání: ' + error.message); return; }

    const { data: { user } } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from('worksheet_rag_examples')
      .insert({
        title: fullWs.title || ws.title,
        subject: fullWs.subject || ws.subject || null,
        grade: fullWs.grade || ws.grade || null,
        topic: fullWs.title || ws.title,
        quality_score: 0.8,
        blocks_json: fullWs.blocks || [],
        style_notes: '',
        teacher_worksheet_id: ws.id,
        folder: selectedFolder === UNCATEGORIZED ? UNCATEGORIZED : selectedFolder,
        source: 'manual',
        created_by: user?.id || null,
      });

    if (insertError) { toast.error('Chyba přidání: ' + insertError.message); return; }

    toast.success(`"${ws.title}" přidán do RAG (složka: ${selectedFolder})`);
    setPickerOpen(false);
    await loadEntries();
  };

  const filteredPicker = pickerWorksheets.filter(ws =>
    !pickerSearch || ws.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#F2F5F9] font-sans">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="p-2 bg-violet-100 rounded-xl">
          <Database className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">RAG Knihovna pracovních listů</h1>
          <p className="text-xs text-slate-500">Vzorové listy pro generování v Curriculum Factory</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-500">{entries.filter(e => e.source !== 'folder').length} listů celkem</span>
          {entries.some(e => !e.embedding) && (
            <button
              onClick={generateAllMissingEmbeddings}
              disabled={!!generatingEmbedding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              title="Vygenerovat embeddingy pro všechny listy bez embeddingu"
            >
              {generatingEmbedding
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                : <><Cpu className="w-3 h-3" /> Generovat všechny embeddingy ({entries.filter(e => !e.embedding).length})</>}
            </button>
          )}
          <button
            onClick={loadEntries}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            title="Obnovit"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Migration banner */}
      {!folderColumnExists && (
        <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Chybí databázová migrace – sloupec <code className="font-mono bg-amber-100 px-1 rounded">folder</code></p>
            <p className="text-xs text-amber-700 mt-1">Spusť tento SQL příkaz v <a href="https://supabase.com/dashboard/project/njbtqmsxbyvpwigfceke/sql/new" target="_blank" className="underline font-medium">Supabase SQL Editoru</a> a pak obnov stránku:</p>
            <pre className="mt-2 text-xs bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 overflow-x-auto select-all whitespace-pre-wrap break-all">
{`ALTER TABLE worksheet_rag_examples ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'Bez složky';
CREATE INDEX IF NOT EXISTS worksheet_rag_folder_idx ON worksheet_rag_examples (folder);`}
            </pre>
            <div className="flex gap-2 mt-2">
              <a
                href="https://supabase.com/dashboard/project/njbtqmsxbyvpwigfceke/sql/new"
                target="_blank"
                className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
              >
                Otevřít SQL Editor →
              </a>
              <button
                onClick={loadEntries}
                className="text-xs px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-700 rounded-lg"
              >
                Obnovit po migraci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Column 1: Folders ── */}
        <div className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Složky</span>
            <button
              onClick={() => { setAddingFolder(true); setNewFolderName(''); }}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              title="Nová složka"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New folder input */}
          {addingFolder && (
            <div className="px-3 py-2 border-b border-slate-100 flex gap-1">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddFolder();
                  if (e.key === 'Escape') setAddingFolder(false);
                }}
                placeholder="Název složky..."
                className="flex-1 text-sm px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
              <button onClick={handleAddFolder} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setAddingFolder(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            {folders.length === 0 && !loading && (
              <p className="text-xs text-slate-400 px-4 py-3">Žádné složky</p>
            )}
            {folders.map(folder => {
              const count = entries.filter(e => e.folder === folder && e.source !== 'folder').length;
              const isSelected = folder === selectedFolder;
              const isRenaming = renamingFolder === folder;

              return (
                <div
                  key={folder}
                  onClick={() => { setSelectedFolder(folder); setSelectedEntry(null); }}
                  className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-violet-50 text-violet-700' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {isSelected
                    ? <FolderOpen className="w-4 h-4 flex-shrink-0 text-violet-500" />
                    : <Folder className="w-4 h-4 flex-shrink-0 text-slate-400" />
                  }

                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameFolder(folder);
                        if (e.key === 'Escape') setRenamingFolder(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 text-sm px-1 py-0.5 border border-violet-300 rounded focus:outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate">{folder}</span>
                  )}

                  <span className={`text-xs flex-shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-400'}`}>
                    {count}
                  </span>

                  {/* Folder actions */}
                  {isSelected && !isRenaming && folder !== UNCATEGORIZED && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setRenamingFolder(folder); setRenameValue(folder); }}
                        className="p-0.5 rounded hover:bg-violet-100 text-violet-400"
                        title="Přejmenovat"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder)}
                        className="p-0.5 rounded hover:bg-red-100 text-red-400"
                        title="Smazat složku"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Column 2: Entries in folder ── */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-[#F7F9FC] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium text-slate-700 truncate max-w-[140px]">{selectedFolder}</span>
            </div>
            <button
              onClick={openPicker}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Přidat list
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {loading && (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Načítám...
              </div>
            )}

            {!loading && folderEntries.filter(e => e.source !== 'folder').length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <BookOpen className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Žádné pracovní listy</p>
                <p className="text-xs text-slate-300 mt-1">Přidejte list tlačítkem výše</p>
              </div>
            )}

            {!loading && folderEntries
              .filter(e => e.source !== 'folder')
              .map(entry => {
                const isSelected = selectedEntry?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    onClick={() => { setSelectedEntry(entry); setEditingEntry(null); }}
                    className={`group flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 transition-colors ${
                      isSelected ? 'bg-violet-50' : 'hover:bg-white'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <FileText className={`w-4 h-4 ${isSelected ? 'text-violet-500' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>
                        {entry.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {subjectLabel(entry.subject)}{entry.grade ? ` · ${entry.grade}. tř.` : ''}{entry.topic ? ` · ${entry.topic}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${qualityColor(entry.quality_score)}`}>
                          {Math.round(entry.quality_score * 100)} %
                        </span>
                        {entry.embedding ? (
                          <span className="text-xs text-emerald-500 flex items-center gap-0.5">
                            <Cpu className="w-3 h-3" /> embedding
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 flex items-center gap-0.5">
                            <Cpu className="w-3 h-3" /> bez embeddings
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 text-violet-400 mt-1 flex-shrink-0" />}
                  </div>
                );
              })}
          </div>
        </div>

        {/* ── Column 3: Entry detail ── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedEntry && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Database className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-slate-400 font-medium">Vyberte pracovní list</p>
              <p className="text-sm text-slate-300 mt-1">Ze sloupce vlevo</p>
            </div>
          )}

          {selectedEntry && (
            <div className="p-6 max-w-2xl">
              {/* Detail header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-violet-100 rounded-xl flex-shrink-0">
                  <FileText className="w-6 h-6 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingEntry ? (
                    <input
                      value={editingEntry.title}
                      onChange={e => setEditingEntry({ ...editingEntry, title: e.target.value })}
                      className="w-full text-xl font-bold text-slate-800 border-b-2 border-violet-300 focus:outline-none pb-1 bg-transparent"
                    />
                  ) : (
                    <h2 className="text-xl font-bold text-slate-800 leading-tight">{selectedEntry.title}</h2>
                  )}
                  <p className="text-sm text-slate-400 mt-1">
                    Přidáno {new Date(selectedEntry.created_at).toLocaleDateString('cs-CZ')} · zdroj: {selectedEntry.source}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  {editingEntry ? (
                    <>
                      <button
                        onClick={handleSaveEntry}
                        disabled={savingEntry}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg"
                      >
                        {savingEntry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Uložit
                      </button>
                      <button
                        onClick={() => setEditingEntry(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                        Zrušit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingEntry({ ...selectedEntry })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Upravit
                      </button>
                      {selectedEntry.teacher_worksheet_id && (
                        <button
                          onClick={() => window.open(`/admin/workbook-pro/${selectedEntry.teacher_worksheet_id}`, '_blank')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Otevřít v PRO
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteEntry(selectedEntry)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Odebrat
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <MetaField
                  label="Předmět"
                  editing={!!editingEntry}
                  value={editingEntry?.subject || selectedEntry.subject || ''}
                  onChange={v => editingEntry && setEditingEntry({ ...editingEntry, subject: v })}
                  placeholder="matematika"
                />
                <MetaField
                  label="Ročník"
                  editing={!!editingEntry}
                  value={String(editingEntry?.grade || selectedEntry.grade || '')}
                  onChange={v => editingEntry && setEditingEntry({ ...editingEntry, grade: parseInt(v) || null })}
                  placeholder="5"
                  type="number"
                />
                <MetaField
                  label="Téma"
                  editing={!!editingEntry}
                  value={editingEntry?.topic || selectedEntry.topic || ''}
                  onChange={v => editingEntry && setEditingEntry({ ...editingEntry, topic: v })}
                  placeholder="Zlomky"
                />
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Složka</label>
                  {editingEntry ? (
                    <select
                      value={editingEntry.folder}
                      onChange={e => setEditingEntry({ ...editingEntry, folder: e.target.value })}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      {folders.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  ) : (
                    <div className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                      {selectedEntry.folder}
                    </div>
                  )}
                </div>
              </div>

              {/* Quality score */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  Skóre kvality ({editingEntry
                    ? Math.round(editingEntry.quality_score * 100)
                    : Math.round(selectedEntry.quality_score * 100)} %)
                </label>
                {editingEntry ? (
                  <input
                    type="range"
                    min="0" max="1" step="0.05"
                    value={editingEntry.quality_score}
                    onChange={e => setEditingEntry({ ...editingEntry, quality_score: parseFloat(e.target.value) })}
                    className="w-full accent-violet-600"
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${selectedEntry.quality_score >= 0.8 ? 'bg-emerald-500' : selectedEntry.quality_score >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${selectedEntry.quality_score * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded ${qualityColor(selectedEntry.quality_score)}`}>
                      {Math.round(selectedEntry.quality_score * 100)} %
                    </span>
                  </div>
                )}
              </div>

              {/* Style notes */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  Poznámky ke stylu <span className="font-normal text-slate-400">(AI prompt context)</span>
                </label>
                {editingEntry ? (
                  <textarea
                    value={editingEntry.style_notes || ''}
                    onChange={e => setEditingEntry({ ...editingEntry, style_notes: e.target.value })}
                    rows={4}
                    placeholder="Proč je tento list dobrý? Co z něj má AI vzít jako inspiraci?"
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  />
                ) : (
                  <div className="text-sm px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 min-h-[80px] whitespace-pre-wrap">
                    {selectedEntry.style_notes || <span className="text-slate-300 italic">Žádné poznámky</span>}
                  </div>
                )}
              </div>

              {/* Embedding status */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedEntry.embedding ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
                <Cpu className={`w-5 h-5 flex-shrink-0 ${selectedEntry.embedding ? 'text-emerald-500' : 'text-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">
                    {selectedEntry.embedding ? 'Embedding vygenerován ✅' : 'Embedding chybí ⚠️'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedEntry.embedding
                      ? 'Tento list bude nalezen při sémantickém vyhledávání'
                      : 'Bez embeddingu RAG vyhledávání tento list nenajde!'}
                  </p>
                </div>
                {!selectedEntry.embedding && (
                  <button
                    onClick={() => generateEmbeddingForEntry(selectedEntry)}
                    disabled={generatingEmbedding === selectedEntry.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {generatingEmbedding === selectedEntry.id
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                      : <><Cpu className="w-3 h-3" /> Generovat</>}
                  </button>
                )}
              </div>

              {/* Blocks summary */}
              <div className="mt-4 p-3 rounded-xl bg-violet-50 border border-violet-100">
                <p className="text-xs font-medium text-violet-600 mb-1">Obsah listu</p>
                <p className="text-xs text-violet-500">
                  Blokový obsah pracovního listu je uložen v RAG databázi a využívá se jako kontext pro generování.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Worksheet Picker Modal ── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-slate-800">Přidat pracovní list do RAG</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Složka: <strong>{selectedFolder}</strong>
                </p>
              </div>
              <button onClick={() => setPickerOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Hledat list..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-80 px-3 pb-4">
              {pickerLoading && (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Načítám listy...
                </div>
              )}
              {!pickerLoading && filteredPicker.length === 0 && (
                <div className="flex flex-col items-center py-8 text-slate-400">
                  <AlertCircle className="w-6 h-6 mb-2" />
                  <p className="text-sm">Žádné listy nenalezeny</p>
                </div>
              )}
              {!pickerLoading && filteredPicker.map(ws => {
                const alreadyIn = entries.find(e => e.teacher_worksheet_id === ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => !alreadyIn && handlePickWorksheet(ws)}
                    disabled={!!alreadyIn}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left my-0.5 ${
                      alreadyIn
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-violet-50 cursor-pointer'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{ws.title}</p>
                      <p className="text-xs text-slate-400">
                        {subjectLabel(ws.subject || null)}{ws.grade ? ` · ${ws.grade}. třída` : ''}
                        {alreadyIn ? ` · ✓ v RAG (${alreadyIn.folder})` : ''}
                      </p>
                    </div>
                    {!alreadyIn && <Plus className="w-4 h-4 text-violet-400 flex-shrink-0" />}
                    {alreadyIn && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper komponenta – jedno metadata pole
// ─────────────────────────────────────────────────────────────────────────────

function MetaField({
  label,
  value,
  editing,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      ) : (
        <div className="text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
          {value || <span className="text-slate-300">–</span>}
        </div>
      )}
    </div>
  );
}
