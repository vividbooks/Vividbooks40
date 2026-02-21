/**
 * Curriculum Factory V2
 * 
 * Přepracovaný design se sloupcovým layoutem jako admin knihovna.
 * Konzole | Nastavení + Agenti | Výstup agenta | Detail | Sub-detail
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Calendar,
  Layers,
  Sparkles,
  Package,
  Settings,
  Terminal,
  Eye,
  Save,
  Trash2,
  Image as ImageIcon,
  FileText,
  BookOpen,
  GraduationCap,
  Database,
  FolderOpen,
  Folder,
  X,
  Check,
  AlertCircle,
  Info
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import {
  runAgent1,
  runAgent2,
  runAgent3DataSet,
  runAgent4DataSet,
  runAgent6DataSet
} from '../../utils/curriculum/agents';
import {
  SubjectCode,
  Grade,
  SUBJECT_NAMES,
  GRADE_NAMES
} from '../../types/curriculum';

// =====================================================
// TYPES
// =====================================================

interface Agent {
  id: number;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  outputType: 'rvp' | 'plans' | 'datasets' | 'materials' | 'published';
}

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ColumnItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  type: 'folder' | 'item';
  data?: any;
  children?: ColumnItem[];
  badge?: string | number;
}

// =====================================================
// CONSTANTS
// =====================================================

const AGENTS: Agent[] = [
  {
    id: 1,
    name: 'RVP Scout',
    icon: <Search className="w-4 h-4" />,
    description: 'Stáhne RVP témata a kompetence',
    color: '#3B82F6',
    status: 'idle',
    outputType: 'rvp'
  },
  {
    id: 2,
    name: 'Planner',
    icon: <Calendar className="w-4 h-4" />,
    description: 'Rozloží učivo do týdenních plánů',
    color: '#8B5CF6',
    status: 'idle',
    outputType: 'plans'
  },
  {
    id: 3,
    name: 'Data Collector',
    icon: <Layers className="w-4 h-4" />,
    description: 'Vytvoří DataSety (pojmy, fakta, obrázky)',
    color: '#EC4899',
    status: 'idle',
    outputType: 'datasets'
  },
  {
    id: 4,
    name: 'Creator',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Generuje materiály z DataSetů',
    color: '#F59E0B',
    status: 'idle',
    outputType: 'materials'
  },
  {
    id: 5,
    name: 'Publisher',
    icon: <Package className="w-4 h-4" />,
    description: 'Ukládá do admin knihovny',
    color: '#10B981',
    status: 'idle',
    outputType: 'published'
  }
];

// =====================================================
// COLUMN COMPONENT
// =====================================================

interface ColumnProps {
  title: string;
  items: ColumnItem[];
  selectedId: string | null;
  onSelect: (item: ColumnItem) => void;
  loading?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  badge?: string | number;
}

function Column({ 
  title, 
  items, 
  selectedId, 
  onSelect, 
  loading, 
  emptyMessage = 'Žádné položky',
  actions,
  badge
}: ColumnProps) {
  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white flex-shrink-0" style={{ width: 330 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {actions}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FolderOpen className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">{emptyMessage}</span>
          </div>
        ) : (
          <div className="py-1">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${selectedId === item.id 
                    ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500' 
                    : 'hover:bg-slate-50 text-slate-700'
                  }
                `}
              >
                {item.icon || (item.type === 'folder' ? (
                  <Folder className="w-4 h-4 text-amber-500" />
                ) : (
                  <FileText className="w-4 h-4 text-slate-400" />
                ))}
                <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// CONSOLE COMPONENT
// =====================================================

interface ConsoleProps {
  logs: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
}

function Console({ logs, isOpen, onToggle }: ConsoleProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          left: '16px',
          bottom: '16px',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: '#1e293b',
          color: 'white',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Terminal className="w-4 h-4" />
        <span className="text-sm font-medium">Konzole</span>
        {logs.length > 0 && (
          <span className="px-2 py-0.5 text-xs bg-slate-600 rounded-full">{logs.length}</span>
        )}
      </button>
    );
  }
  
  return (
    <div className="flex flex-col h-full border-r border-slate-700 bg-slate-900 flex-shrink-0" style={{ width: 330 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="font-semibold text-slate-200 text-sm">Konzole</span>
        </div>
        <button
          onClick={onToggle}
          style={{
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      
      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
        {logs.map((log) => (
          <div 
            key={log.id}
            className={`
              flex items-start gap-2 py-1
              ${log.type === 'error' ? 'text-red-400' : ''}
              ${log.type === 'success' ? 'text-green-400' : ''}
              ${log.type === 'warning' ? 'text-yellow-400' : ''}
              ${log.type === 'info' ? 'text-slate-400' : ''}
            `}
          >
            <span className="text-slate-600 shrink-0">
              {log.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="break-words">{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

// =====================================================
// SETTINGS COLUMN COMPONENT
// =====================================================

interface SettingsColumnProps {
  selectedSubject: SubjectCode | null;
  selectedGrade: Grade | null;
  onSubjectChange: (subject: SubjectCode) => void;
  onGradeChange: (grade: Grade) => void;
  agents: Agent[];
  selectedAgentId: number | null;
  onAgentSelect: (agent: Agent) => void;
  onRunPipeline: () => void;
  isRunning: boolean;
}

function SettingsColumn({
  selectedSubject,
  selectedGrade,
  onSubjectChange,
  onGradeChange,
  agents,
  selectedAgentId,
  onAgentSelect,
  onRunPipeline,
  isRunning
}: SettingsColumnProps) {
  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white flex-shrink-0" style={{ width: 330 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Nastavení</span>
      </div>
      
      {/* Subject & Grade Selection */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Předmět</label>
          <select
            value={selectedSubject || ''}
            onChange={(e) => onSubjectChange(e.target.value as SubjectCode)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Vyberte předmět</option>
            {Object.entries(SUBJECT_NAMES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Ročník</label>
          <select
            value={selectedGrade || ''}
            onChange={(e) => onGradeChange(Number(e.target.value) as Grade)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Vyberte ročník</option>
            {Object.entries(GRADE_NAMES).map(([grade, name]) => (
              <option key={grade} value={grade}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Agents List */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Agenti</span>
        </div>
        
        <div className="py-1">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onAgentSelect(agent)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${selectedAgentId === agent.id 
                  ? 'bg-indigo-50 border-r-2 border-indigo-500' 
                  : 'hover:bg-slate-50'
                }
              `}
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
              >
                {agent.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{agent.name}</div>
                <div className="text-xs text-slate-400 truncate">{agent.description}</div>
              </div>
              {agent.status === 'running' && (
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              )}
              {agent.status === 'completed' && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              {agent.status === 'error' && (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Run Button */}
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={onRunPipeline}
          disabled={!selectedSubject || !selectedGrade || isRunning}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontWeight: 500,
            border: 'none',
            cursor: (!selectedSubject || !selectedGrade || isRunning) ? 'not-allowed' : 'pointer',
            backgroundColor: isRunning ? '#475569' : ((!selectedSubject || !selectedGrade) ? '#94a3b8' : '#22c55e'),
            color: 'white',
            opacity: (!selectedSubject || !selectedGrade) ? 0.5 : 1,
          }}
          className={`
            ${isRunning
              ? 'bg-amber-500 text-white'
              : !selectedSubject || !selectedGrade
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/25'
            }
          `}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Běží...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Spustit pipeline</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function CurriculumFactoryV2() {
  const navigate = useNavigate();
  
  // State
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Selection state
  const [selectedSubject, setSelectedSubject] = useState<SubjectCode | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  
  // Data state
  const [dataSets, setDataSets] = useState<any[]>([]);
  const [dataSetsLoading, setDataSetsLoading] = useState(false);
  const [selectedDataSet, setSelectedDataSet] = useState<any | null>(null);
  const [selectedDataSetSection, setSelectedDataSetSection] = useState<string | null>(null);
  
  // Pipeline state
  const [isRunning, setIsRunning] = useState(false);
  
  // Generation state (for illustrations/photos)
  const [generatingPromptId, setGeneratingPromptId] = useState<string | null>(null);
  const [generatingIllustrationPrompts, setGeneratingIllustrationPrompts] = useState(false);
  const [generatingPhotoPrompts, setGeneratingPhotoPrompts] = useState(false);

  const saveMediaToDB = useCallback(async (dataSetId: string, mediaUpdates: Record<string, any>) => {
    const { data, error: readError } = await supabase
      .from('topic_data_sets')
      .select('media')
      .eq('id', dataSetId)
      .single();
    if (readError) {
      console.error('[saveMediaToDB] Read error:', readError);
      throw readError;
    }
    const currentMedia = data?.media || {};
    const mergedMedia = { ...currentMedia, ...mediaUpdates };
    const { error: writeError } = await supabase
      .from('topic_data_sets')
      .update({ media: mergedMedia })
      .eq('id', dataSetId);
    if (writeError) {
      console.error('[saveMediaToDB] Write error:', writeError);
      throw writeError;
    }
    return mergedMedia;
  }, []);
  
  // Material regeneration state
  const [regeneratingMaterialId, setRegeneratingMaterialId] = useState<string | null>(null);
  const [materialFeedback, setMaterialFeedback] = useState<string>('');
  const [showFeedbackFor, setShowFeedbackFor] = useState<string | null>(null);
  const [savingMaterials, setSavingMaterials] = useState(false);
  // Klik na materiál = další sloupec s detailem + chat
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState<number | null>(null);
  // Lekce: wizard s návrhem témat + chat pro popis
  const [lessonWizardOpen, setLessonWizardOpen] = useState(false);
  const [lessonSuggestedTopics, setLessonSuggestedTopics] = useState<string[]>([]);
  const [lessonSelectedTopics, setLessonSelectedTopics] = useState<Set<string>>(new Set());
  const [lessonSelectedCompetencies, setLessonSelectedCompetencies] = useState<Set<number>>(new Set());
  const [lessonSelectedFacts, setLessonSelectedFacts] = useState<Set<number>>(new Set());
  const [lessonDescription, setLessonDescription] = useState('');
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [lessonJustGenerated, setLessonJustGenerated] = useState(false);
  
  // =====================================================
  // LOGGING
  // =====================================================
  
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      message,
      type
    }]);
  }, []);
  
  // =====================================================
  // DATA LOADING
  // =====================================================
  
  const loadDataSets = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    
    setDataSetsLoading(true);
    addLog(`Načítám DataSety pro ${SUBJECT_NAMES[selectedSubject]} ${selectedGrade}. ročník...`);
    
    try {
      const { data, error } = await supabase
        .from('topic_data_sets')
        .select('id, topic, status, grade, subject_code, rvp, content, generated_materials, created_at, updated_at')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setDataSets(data || []);
      addLog(`Načteno ${data?.length || 0} DataSetů`, 'success');
    } catch (err: any) {
      addLog(`Chyba: ${err.message}`, 'error');
    } finally {
      setDataSetsLoading(false);
    }
  }, [selectedSubject, selectedGrade, addLog]);
  
  // Load data when subject/grade changes
  useEffect(() => {
    if (selectedSubject && selectedGrade) {
      loadDataSets();
    }
  }, [selectedSubject, selectedGrade, loadDataSets]);
  
  // Lazy load media when DataSet is selected
  const loadMediaForDataSet = useCallback(async (dataSetId: string) => {
    try {
      const { data, error } = await supabase
        .from('topic_data_sets')
        .select('media')
        .eq('id', dataSetId)
        .single();
      
      if (error) throw error;
      
      // Update the selected dataset with media
      setSelectedDataSet((prev: any) => prev ? { ...prev, media: data?.media || {} } : null);
      
      // Also update in the list
      setDataSets(prev => prev.map(ds => 
        ds.id === dataSetId ? { ...ds, media: data?.media || {} } : ds
      ));
      
      addLog(`Načtena media pro DataSet`, 'success');
    } catch (err: any) {
      addLog(`Chyba načítání media: ${err.message}`, 'error');
    }
  }, [addLog]);
  
  // Load media when DataSet is selected
  useEffect(() => {
    if (selectedDataSet?.id && !selectedDataSet.media) {
      loadMediaForDataSet(selectedDataSet.id);
    }
  }, [selectedDataSet?.id, selectedDataSet?.media, loadMediaForDataSet]);
  
  // Při přepnutí ze sekce Materiály zrušit výběr materiálu a lekce wizard
  useEffect(() => {
    if (selectedDataSetSection !== 'materials') {
      setSelectedMaterialIndex(null);
      setLessonWizardOpen(false);
    }
  }, [selectedDataSetSection]);
  
  // =====================================================
  // PIPELINE
  // =====================================================
  
  const runPipeline = async () => {
    if (!selectedSubject || !selectedGrade) return;
    
    setIsRunning(true);
    setConsoleOpen(true);
    addLog(`🚀 Spouštím pipeline pro ${SUBJECT_NAMES[selectedSubject]} ${selectedGrade}. ročník`);
    
    try {
      // Run agents sequentially
      for (const agent of agents) {
        setAgents(prev => prev.map(a => 
          a.id === agent.id ? { ...a, status: 'running' } : a
        ));
        
        addLog(`▶️ ${agent.name}: Spouštím...`);
        
        // Simulate agent work (replace with actual agent calls)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setAgents(prev => prev.map(a => 
          a.id === agent.id ? { ...a, status: 'completed' } : a
        ));
        
        addLog(`✅ ${agent.name}: Dokončeno`, 'success');
      }
      
      addLog('🎉 Pipeline dokončena!', 'success');
      toast.success('Pipeline dokončena!');
      
      // Reload data
      loadDataSets();
      
    } catch (err: any) {
      addLog(`❌ Chyba: ${err.message}`, 'error');
      toast.error(`Chyba: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  // =====================================================
  // BUILD COLUMN ITEMS
  // =====================================================
  
  const getAgentOutputItems = (): ColumnItem[] => {
    if (!selectedAgentId) return [];
    
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return [];
    
    // Based on agent type, return appropriate items
    if (agent.outputType === 'datasets') {
      return dataSets.map(ds => ({
        id: ds.id,
        label: ds.topic,
        type: 'folder' as const,
        icon: <Database className="w-4 h-4 text-pink-500" />,
        badge: (ds.generated_materials || []).length,
        data: ds
      }));
    }
    
    // TODO: Add other agent output types
    return [];
  };
  
  const getDataSetSections = (): ColumnItem[] => {
    if (!selectedDataSet) return [];
    
    const sections: ColumnItem[] = [
      {
        id: 'data',
        label: 'Podklady',
        type: 'folder',
        icon: <Database className="w-4 h-4 text-blue-500" />,
        badge: (selectedDataSet.content?.keyTerms?.length || 0) + 
               (selectedDataSet.content?.keyFacts?.length || 0) +
               (selectedDataSet.rvp?.expectedOutcomes?.length || 0)
      },
      {
        id: 'images',
        label: 'Obrázky z webu',
        type: 'folder',
        icon: <ImageIcon className="w-4 h-4 text-emerald-500" />,
        badge: (selectedDataSet.media?.images?.length || 0)
      },
      {
        id: 'illustrations',
        label: 'Ilustrace',
        type: 'folder',
        icon: <Sparkles className="w-4 h-4 text-purple-500" />,
        badge: (selectedDataSet.media?.generatedIllustrations?.length || 0)
      },
      {
        id: 'photos',
        label: 'Fotky',
        type: 'folder',
        icon: <ImageIcon className="w-4 h-4 text-amber-500" />,
        badge: (selectedDataSet.media?.generatedPhotos?.length || 0)
      },
      {
        id: 'materials',
        label: 'Materiály',
        type: 'folder',
        icon: <FileText className="w-4 h-4 text-indigo-500" />,
        badge: (selectedDataSet.generated_materials?.length || 0)
      }
    ];
    
    return sections;
  };
  
  const getSectionDetail = (): React.ReactNode => {
    if (!selectedDataSet || !selectedDataSetSection) return null;
    
    const section = selectedDataSetSection;
    
    if (section === 'data') {
      const rvp = selectedDataSet.rvp || {};
      const content = selectedDataSet.content || {};
      const terms = content.keyTerms || [];
      const facts = content.keyFacts || [];
      const personalities = content.personalities || [];
      
      return (
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* RVP Info */}
          {rvp.thematicArea && (
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <h3 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                RVP - Rámcový vzdělávací program
              </h3>
              
              {rvp.thematicArea && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">Tematický okruh</div>
                  <div className="text-sm text-slate-700">{rvp.thematicArea}</div>
                </div>
              )}
              
              {rvp.expectedOutcomes?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">
                    Očekávané výstupy ({rvp.expectedOutcomes.length})
                  </div>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {rvp.expectedOutcomes.map((outcome: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {rvp.competencies?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">
                    Klíčové kompetence ({rvp.competencies.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rvp.competencies.map((comp: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-white text-indigo-600 text-xs rounded-full border border-indigo-200">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Klíčové pojmy */}
          {terms.length > 0 && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Klíčové pojmy ({terms.length})
              </h3>
              <div className="space-y-2">
                {terms.map((term: any, idx: number) => (
                  <div key={idx} className="p-2 bg-white rounded-lg border border-emerald-100">
                    <div className="font-medium text-slate-700 text-sm">
                      {typeof term === 'string' ? term : term.term}
                    </div>
                    {term.definition && (
                      <div className="text-xs text-slate-500 mt-1">{term.definition}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Fakta */}
          {facts.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h3 className="font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Klíčová fakta ({facts.length})
              </h3>
              <ul className="space-y-2">
                {facts.map((fact: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-amber-500 mt-0.5">💡</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Osobnosti */}
          {personalities.length > 0 && (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <h3 className="font-semibold text-purple-700 mb-3 flex items-center gap-2">
                👤 Osobnosti ({personalities.length})
              </h3>
              <div className="space-y-2">
                {personalities.map((person: any, idx: number) => (
                  <div key={idx} className="p-2 bg-white rounded-lg border border-purple-100">
                    <div className="font-medium text-slate-700 text-sm">{person.name}</div>
                    {person.description && (
                      <div className="text-xs text-slate-500 mt-1">{person.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Prázdný stav */}
          {!rvp.thematicArea && terms.length === 0 && facts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné podklady</p>
              <p className="text-sm">Spusťte agenta "Data Collector"</p>
            </div>
          )}
        </div>
      );
    }
    
    if (section === 'images') {
      const images = selectedDataSet.media?.images || [];
      const activeCount = images.filter((img: any) => !img.excluded).length;
      
      const toggleImageExclusion = async (idx: number) => {
        const updatedImages = images.map((i: any, iIdx: number) => 
          iIdx === idx ? { ...i, excluded: !i.excluded } : i
        );
        
        // Update local state
        setDataSets(prev => prev.map(ds => 
          ds.id === selectedDataSet.id 
            ? { ...ds, media: { ...ds.media, images: updatedImages } }
            : ds
        ));
        setSelectedDataSet((prev: any) => ({
          ...prev,
          media: { ...prev.media, images: updatedImages }
        }));
        
        // Save to DB
        await supabase
          .from('topic_data_sets')
          .update({ media: { ...selectedDataSet.media, images: updatedImages } })
          .eq('id', selectedDataSet.id);
      };
      
      return (
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">
              🖼️ Obrázky z webu ({activeCount}/{images.length})
            </h3>
            <div className="text-xs text-slate-400">
              ✅ = použít | ❌ = vyloučit
            </div>
          </div>
          
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {images.map((img: any, idx: number) => (
                <div 
                  key={idx}
                  className={`
                    rounded-xl overflow-hidden transition-all
                    ${img.excluded 
                      ? 'border-3 border-red-400 opacity-50 bg-red-50' 
                      : 'border-3 border-emerald-400 bg-emerald-50'
                    }
                  `}
                  style={{ borderWidth: '3px' }}
                >
                  {/* Image */}
                  <img 
                    src={img.thumbnailUrl || img.url} 
                    alt={img.title || `Obrázek ${idx + 1}`}
                    className="w-full h-24 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.background = '#e2e8f0';
                      (e.target as HTMLImageElement).alt = '⚠️';
                    }}
                  />
                  
                  {/* Status badge */}
                  <div 
                    className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: img.excluded ? '#ef4444' : img.priority ? '#f59e0b' : '#22c55e' }}
                  >
                    {img.excluded ? '❌ VYLOUČENO' : img.priority ? '⭐ PRIORITNÍ' : '✅ AKTIVNÍ'}
                  </div>
                  
                  {/* Title */}
                  <div className="px-2 py-1 bg-black/70 text-white text-xs truncate">
                    {img.title || `Obrázek ${idx + 1}`}
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex gap-1 p-2 bg-slate-50">
                    {/* Priority button */}
                    <button
                      onClick={() => {
                        setSelectedDataSet((prev: any) => {
                          const currentImages = prev.media?.images || [];
                          const updatedImages = currentImages.map((i: any, iIdx: number) => 
                            iIdx === idx ? { ...i, priority: !i.priority } : i
                          );
                          supabase
                            .from('topic_data_sets')
                            .update({ media: { ...prev.media, images: updatedImages } })
                            .eq('id', prev.id);
                          return {
                            ...prev,
                            media: { ...prev.media, images: updatedImages }
                          };
                        });
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: img.priority ? '#f59e0b' : '#e5e7eb',
                        color: img.priority ? 'white' : '#374151',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title="Prioritní obrázek - bude použit přednostně"
                    >
                      ⭐
                    </button>
                    {/* Exclude/restore button */}
                    <button
                      onClick={() => toggleImageExclusion(idx)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: img.excluded ? '#10b981' : '#ef4444',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {img.excluded ? '✅ Obnovit' : '❌ Vyloučit'}
                    </button>
                    <button
                      onClick={() => window.open(img.url, '_blank')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      👁️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné obrázky</p>
              <p className="text-sm">Spusťte agenta "Data Collector"</p>
            </div>
          )}
        </div>
      );
    }
    
    if (section === 'illustrations') {
      const illustrations = selectedDataSet.media?.generatedIllustrations || [];
      const prompts = selectedDataSet.media?.illustrationPrompts || [];
      
      const handleGeneratePrompts = async () => {
        setGeneratingIllustrationPrompts(true);
        addLog('🎨 Generuji prompty pro ilustrace...');
        
        try {
          const { generateIllustrationPrompts } = await import('../../utils/dataset/material-generators');
          const newPrompts = await generateIllustrationPrompts({
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: selectedDataSet.content || {},
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          });
          
          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { illustrationPrompts: newPrompts });
          
          setSelectedDataSet((prev: any) => ({
            ...prev,
            media: mergedMedia
          }));
          
          addLog(`✅ Vygenerováno ${newPrompts.length} promptů`, 'success');
          toast.success(`${newPrompts.length} promptů připraveno`);
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setGeneratingIllustrationPrompts(false);
        }
      };
      
      const handleGenerateSingleIllustration = async (prompt: any) => {
        setGeneratingPromptId(prompt.id);
        addLog(`🎨 Generuji: ${prompt.name}...`);
        
        try {
          const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
          const { processImageUrl } = await import('../../utils/supabase/upload-image');
          
          const result = await generateImageWithImagen(prompt.prompt, {
            aspectRatio: '1:1',
            numberOfImages: 1,
          });
          
          if (result.success && (result.url || result.images?.[0]?.base64)) {
            let rawUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
            const imageUrl = await processImageUrl(rawUrl, `${selectedDataSet.id}-${prompt.id}`, 'illustrations');
            
            if (imageUrl) {
              const newIllustration = {
                id: prompt.id,
                name: prompt.name,
                url: imageUrl,
                category: prompt.category,
              };
              
              const { data: freshData } = await supabase
                .from('topic_data_sets')
                .select('media')
                .eq('id', selectedDataSet.id)
                .single();
              const freshMedia = freshData?.media || {};
              
              const currentIllustrations = freshMedia.generatedIllustrations || [];
              const currentPrompts = freshMedia.illustrationPrompts || [];
              
              const alreadyExists = currentIllustrations.some((ill: any) => ill.id === prompt.id);
              const updatedIllustrations = alreadyExists 
                ? currentIllustrations.map((ill: any) => ill.id === prompt.id ? newIllustration : ill)
                : [...currentIllustrations, newIllustration];
              
              const updatedPrompts = currentPrompts.map((p: any) => 
                p.id === prompt.id ? { ...p, status: 'completed' } : p
              );
              
              const mergedMedia = {
                ...freshMedia,
                generatedIllustrations: updatedIllustrations,
                illustrationPrompts: updatedPrompts
              };
              
              const { error: saveErr } = await supabase
                .from('topic_data_sets')
                .update({ media: mergedMedia })
                .eq('id', selectedDataSet.id);
              
              if (saveErr) {
                console.error('[Illustrations] Save error:', saveErr);
                toast.error('Uložení do DB selhalo');
              }
              
              setSelectedDataSet((prev: any) => ({
                ...prev,
                media: mergedMedia
              }));
              
              addLog(`✅ Vygenerováno: ${prompt.name}`, 'success');
              toast.success('Ilustrace vygenerována!');
            }
          } else {
            throw new Error(result.error || 'Generování selhalo');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setGeneratingPromptId(null);
        }
      };
      
      return (
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">
              🎨 Ilustrace ({illustrations.length})
            </h3>
            <button
              onClick={handleGeneratePrompts}
              disabled={generatingIllustrationPrompts}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: generatingIllustrationPrompts ? '#9333ea' : '#9333ea',
                color: 'white',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                cursor: generatingIllustrationPrompts ? 'not-allowed' : 'pointer',
                opacity: generatingIllustrationPrompts ? 0.5 : 1,
              }}
            >
              {generatingIllustrationPrompts ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Generovat prompty
            </button>
          </div>
          
          {/* Vygenerované ilustrace */}
          {illustrations.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {illustrations.map((ill: any, idx: number) => (
                <div 
                  key={idx}
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    border: `3px solid ${ill.excluded ? '#ef4444' : '#a855f7'}`,
                    opacity: ill.excluded ? 0.5 : 1,
                  }}
                >
                  <img 
                    src={ill.url} 
                    alt={ill.name || 'Ilustrace'}
                    className="w-full h-32 object-cover"
                    style={{ filter: ill.excluded ? 'grayscale(100%)' : 'none' }}
                  />
                  <div 
                    className="absolute top-2 left-2 px-2 py-1 text-white text-xs font-bold rounded"
                    style={{ backgroundColor: ill.excluded ? '#ef4444' : ill.priority ? '#f59e0b' : '#22c55e' }}
                  >
                    {ill.excluded ? '❌ Vyřazeno' : ill.priority ? '⭐ Prioritní' : '✅ Aktivní'}
                  </div>
                  <div className="p-2 bg-black/70 text-white text-xs truncate">
                    {ill.name || 'Ilustrace'}
                  </div>
                  <div className="flex gap-1 p-2 bg-slate-50">
                    {/* Tlačítko priority */}
                    <button
                      onClick={async () => {
                        const illId = ill.id;
                        const currentIllustrations = selectedDataSet.media?.generatedIllustrations || [];
                        const updatedIllustrations = currentIllustrations.map((i: any) => 
                          i.id === illId ? { ...i, priority: !i.priority } : i
                        );
                        try {
                          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { generatedIllustrations: updatedIllustrations });
                          setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
                        } catch (e) {
                          toast.error('Uložení selhalo');
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: ill.priority ? '#f59e0b' : '#e5e7eb',
                        color: ill.priority ? 'white' : '#374151',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title="Prioritní obrázek - bude použit přednostně"
                    >
                      ⭐
                    </button>
                    {/* Tlačítko vyřadit/obnovit */}
                    <button
                      onClick={async () => {
                        const illId = ill.id;
                        const currentIllustrations = selectedDataSet.media?.generatedIllustrations || [];
                        const updatedIllustrations = currentIllustrations.map((i: any) => 
                          i.id === illId ? { ...i, excluded: !i.excluded } : i
                        );
                        try {
                          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { generatedIllustrations: updatedIllustrations });
                          setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
                        } catch (e) {
                          toast.error('Uložení selhalo');
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: ill.excluded ? '#10b981' : '#ef4444',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {ill.excluded ? '✅ Obnovit' : '❌ Vyřadit'}
                    </button>
                    <button
                      onClick={() => window.open(ill.url, '_blank')}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => {
                        // Find the prompt for this illustration and regenerate
                        // Díky deduplikaci v handleGenerateSingleIllustration se stará ilustrace přepíše novou
                        const prompt = prompts.find((p: any) => p.id === ill.id);
                        if (prompt) {
                          // Označit prompt jako nekompletní a přegenerovat
                          setSelectedDataSet((prev: any) => {
                            const currentPrompts = prev.media?.illustrationPrompts || [];
                            const updatedPrompts = currentPrompts.map((p: any) => 
                              p.id === ill.id ? { ...p, status: 'pending' } : p
                            );
                            return {
                              ...prev,
                              media: { ...prev.media, illustrationPrompts: updatedPrompts }
                            };
                          });
                          // Generovat znovu (stará bude přepsána díky deduplikaci)
                          handleGenerateSingleIllustration(prompt);
                        }
                      }}
                      disabled={generatingPromptId === ill.id}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: '#9333ea',
                        color: 'white',
                        border: 'none',
                        cursor: generatingPromptId === ill.id ? 'not-allowed' : 'pointer',
                        opacity: generatingPromptId === ill.id ? 0.5 : 1,
                      }}
                    >
                      {generatingPromptId === ill.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Prompty k vygenerování */}
          {prompts.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-600">
                Prompty ({prompts.filter((p: any) => p.status !== 'completed').length} k vygenerování)
              </div>
              {prompts.filter((p: any) => p.status !== 'completed').map((prompt: any) => (
                <div 
                  key={prompt.id}
                  className="p-3 bg-purple-50 rounded-xl border border-purple-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-medium text-purple-700 text-sm">{prompt.name}</div>
                    <button
                      onClick={() => handleGenerateSingleIllustration(prompt)}
                      disabled={generatingPromptId === prompt.id}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: '#9333ea',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: generatingPromptId === prompt.id ? 'not-allowed' : 'pointer',
                        opacity: generatingPromptId === prompt.id ? 0.5 : 1,
                      }}
                    >
                      {generatingPromptId === prompt.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Generovat
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-2">{prompt.prompt}</div>
                </div>
              ))}
            </div>
          )}
          
          {/* Prázdný stav */}
          {illustrations.length === 0 && prompts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné ilustrace</p>
              <p className="text-sm">Klikni na "Generovat prompty"</p>
            </div>
          )}
        </div>
      );
    }
    
    if (section === 'photos') {
      const photos = selectedDataSet.media?.generatedPhotos || [];
      const prompts = selectedDataSet.media?.photoPrompts || [];
      
      const handleGeneratePrompts = async () => {
        setGeneratingPhotoPrompts(true);
        addLog('📷 Generuji prompty pro fotky...');
        
        try {
          const { generatePhotoPrompts } = await import('../../utils/dataset/material-generators');
          const newPrompts = await generatePhotoPrompts({
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: selectedDataSet.content || {},
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          });
          
          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { photoPrompts: newPrompts });
          
          setSelectedDataSet((prev: any) => ({
            ...prev,
            media: mergedMedia
          }));
          
          addLog(`✅ Vygenerováno ${newPrompts.length} promptů`, 'success');
          toast.success(`${newPrompts.length} promptů připraveno`);
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setGeneratingPhotoPrompts(false);
        }
      };
      
      const handleGenerateSinglePhoto = async (prompt: any) => {
        setGeneratingPromptId(prompt.id);
        addLog(`📷 Generuji: ${prompt.name}...`);
        
        try {
          const { generatePhoto } = await import('../../utils/dataset/material-generators');
          
          // Zachytit potřebné hodnoty z selectedDataSet před async operací
          const dataSetSnapshot = {
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: selectedDataSet.content || {},
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
          
          const imageUrl = await generatePhoto(prompt, dataSetSnapshot);
          
          if (imageUrl) {
            const newPhoto = {
              id: prompt.id,
              name: prompt.name,
              url: imageUrl,
              category: prompt.category,
            };
            
            const { data: freshData } = await supabase
              .from('topic_data_sets')
              .select('media')
              .eq('id', selectedDataSet.id)
              .single();
            const freshMedia = freshData?.media || {};
            
            const currentPhotos = freshMedia.generatedPhotos || [];
            const currentPrompts = freshMedia.photoPrompts || [];
            
            const alreadyExists = currentPhotos.some((p: any) => p.id === prompt.id);
            const updatedPhotos = alreadyExists 
              ? currentPhotos.map((p: any) => p.id === prompt.id ? newPhoto : p)
              : [...currentPhotos, newPhoto];
            
            const updatedPrompts = currentPrompts.map((p: any) => 
              p.id === prompt.id ? { ...p, status: 'completed' } : p
            );
            
            const mergedMedia = {
              ...freshMedia,
              generatedPhotos: updatedPhotos,
              photoPrompts: updatedPrompts
            };
            
            const { error: saveErr } = await supabase
              .from('topic_data_sets')
              .update({ media: mergedMedia })
              .eq('id', selectedDataSet.id);
            
            if (saveErr) {
              console.error('[Photos] Save error:', saveErr);
              toast.error('Uložení do DB selhalo');
            }
            
            setSelectedDataSet((prev: any) => ({
              ...prev,
              media: mergedMedia
            }));
            
            addLog(`✅ Vygenerováno: ${prompt.name}`, 'success');
            toast.success('Fotka vygenerována!');
          } else {
            throw new Error('Generování selhalo');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setGeneratingPromptId(null);
        }
      };
      
      return (
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">
              📷 Fotorealistické fotky ({photos.length})
            </h3>
            <button
              onClick={handleGeneratePrompts}
              disabled={generatingPhotoPrompts}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: '#d97706',
                color: 'white',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                cursor: generatingPhotoPrompts ? 'not-allowed' : 'pointer',
                opacity: generatingPhotoPrompts ? 0.5 : 1,
              }}
            >
              {generatingPhotoPrompts ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
              Generovat prompty
            </button>
          </div>
          
          {/* Vygenerované fotky */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {photos.map((photo: any, idx: number) => (
                <div 
                  key={idx}
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    border: `3px solid ${photo.excluded ? '#ef4444' : '#f59e0b'}`,
                    opacity: photo.excluded ? 0.5 : 1,
                  }}
                >
                  <img 
                    src={photo.url} 
                    alt={photo.name || 'Fotka'}
                    className="w-full h-32 object-cover"
                    style={{ filter: photo.excluded ? 'grayscale(100%)' : 'none' }}
                  />
                  <div 
                    className="absolute top-2 left-2 px-2 py-1 text-white text-xs font-bold rounded"
                    style={{ backgroundColor: photo.excluded ? '#ef4444' : photo.priority ? '#f59e0b' : '#22c55e' }}
                  >
                    {photo.excluded ? '❌ Vyřazeno' : photo.priority ? '⭐ Prioritní' : '✅ Aktivní'}
                  </div>
                  <div className="p-2 bg-black/70 text-white text-xs truncate">
                    {photo.name || 'Fotka'}
                  </div>
                  <div className="flex gap-1 p-2 bg-slate-50">
                    {/* Tlačítko priority */}
                    <button
                      onClick={async () => {
                        const photoId = photo.id;
                        const currentPhotos = selectedDataSet.media?.generatedPhotos || [];
                        const updatedPhotos = currentPhotos.map((p: any) => 
                          p.id === photoId ? { ...p, priority: !p.priority } : p
                        );
                        try {
                          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { generatedPhotos: updatedPhotos });
                          setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
                        } catch (e) {
                          toast.error('Uložení selhalo');
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: photo.priority ? '#f59e0b' : '#e5e7eb',
                        color: photo.priority ? 'white' : '#374151',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title="Prioritní obrázek - bude použit přednostně"
                    >
                      ⭐
                    </button>
                    {/* Tlačítko vyřadit/obnovit */}
                    <button
                      onClick={async () => {
                        const photoId = photo.id;
                        const currentPhotos = selectedDataSet.media?.generatedPhotos || [];
                        const updatedPhotos = currentPhotos.map((p: any) => 
                          p.id === photoId ? { ...p, excluded: !p.excluded } : p
                        );
                        try {
                          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { generatedPhotos: updatedPhotos });
                          setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
                        } catch (e) {
                          toast.error('Uložení selhalo');
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: photo.excluded ? '#10b981' : '#ef4444',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {photo.excluded ? '✅ Obnovit' : '❌ Vyřadit'}
                    </button>
                    <button
                      onClick={() => window.open(photo.url, '_blank')}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => {
                        // Find the prompt for this photo and regenerate
                        // Díky deduplikaci v handleGenerateSinglePhoto se stará fotka přepíše novou
                        const prompt = prompts.find((p: any) => p.id === photo.id);
                        if (prompt) {
                          // Označit prompt jako nekompletní a přegenerovat
                          setSelectedDataSet((prev: any) => {
                            const currentPrompts = prev.media?.photoPrompts || [];
                            const updatedPrompts = currentPrompts.map((p: any) => 
                              p.id === photo.id ? { ...p, status: 'pending' } : p
                            );
                            return {
                              ...prev,
                              media: { ...prev.media, photoPrompts: updatedPrompts }
                            };
                          });
                          // Generovat znovu (stará bude přepsána díky deduplikaci)
                          handleGenerateSinglePhoto(prompt);
                        }
                      }}
                      disabled={generatingPromptId === photo.id}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: '#d97706',
                        color: 'white',
                        border: 'none',
                        cursor: generatingPromptId === photo.id ? 'not-allowed' : 'pointer',
                        opacity: generatingPromptId === photo.id ? 0.5 : 1,
                      }}
                    >
                      {generatingPromptId === photo.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Prompty k vygenerování */}
          {prompts.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-600">
                Prompty ({prompts.filter((p: any) => p.status !== 'completed').length} k vygenerování)
              </div>
              {prompts.filter((p: any) => p.status !== 'completed').map((prompt: any) => (
                <div 
                  key={prompt.id}
                  className="p-3 bg-amber-50 rounded-xl border border-amber-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-medium text-amber-700 text-sm">{prompt.name}</div>
                    <button
                      onClick={() => handleGenerateSinglePhoto(prompt)}
                      disabled={generatingPromptId === prompt.id}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: '#d97706',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: generatingPromptId === prompt.id ? 'not-allowed' : 'pointer',
                        opacity: generatingPromptId === prompt.id ? 0.5 : 1,
                      }}
                    >
                      {generatingPromptId === prompt.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImageIcon className="w-3 h-3" />
                      )}
                      Generovat
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-2">{prompt.description}</div>
                  <div className="mt-1 text-xs text-amber-600">
                    {prompt.category === 'selfie' ? '📱 Selfie' : `📷 ${prompt.category}`}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Prázdný stav */}
          {photos.length === 0 && prompts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné fotky</p>
              <p className="text-sm">Klikni na "Generovat prompty"</p>
            </div>
          )}
        </div>
      );
    }
    
    if (section === 'materials') {
      const materials = selectedDataSet.generated_materials || [];
      const selectedMat = selectedMaterialIndex !== null ? materials[selectedMaterialIndex] : null;
      
      const handleOpenMaterial = (mat: any) => {
        const matId = mat.id;
        if (!matId) {
          toast.error('Materiál nemá ID');
          return;
        }
        
        // Open based on type
        if (mat.type === 'board-easy' || mat.type === 'board-hard' || mat.type === 'test') {
          window.open(`/quiz/view/${matId}`, '_blank');
        } else if (mat.type === 'worksheet') {
          window.open(`/library/my-content/worksheet-editor/${matId}`, '_blank');
        } else if (mat.type === 'text' || mat.type === 'methodology') {
          window.open(`/library/my-content/view/${matId}`, '_blank');
        } else if (mat.type === 'lesson' || mat.type === 'lessons') {
          // Lekce jsou boardy - použij quiz/edit route
          window.open(`/quiz/edit/${matId}`, '_blank');
        } else {
          toast.info(`Typ "${mat.type}" - náhled zatím není dostupný`);
        }
      };
      
      // Save to admin library menu structure
      const handleSaveToLibrary = async () => {
        setSavingMaterials(true);
        addLog('📚 Ukládám do admin knihovny...');
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Nejste přihlášeni');
          
          const category = selectedSubject;
          
          // 1. Load current menu structure
          addLog('📂 Načítám strukturu knihovny...');
          const menuResp = await fetch(`https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu/${category}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          
          let menuStructure: any[] = [];
          if (menuResp.ok) {
            const data = await menuResp.json();
            menuStructure = data.menu || [];
          }
          
          // 2. Find or create grade folder
          const gradeName = `${selectedGrade}. ročník`;
          let gradeFolder = menuStructure.find((f: any) => f.label === gradeName);
          
          if (!gradeFolder) {
            gradeFolder = {
              id: `folder-${Date.now()}-grade${selectedGrade}`,
              label: gradeName,
              slug: `${selectedGrade}-rocnik`,
              type: 'folder',
              icon: 'folder',
              children: [],
            };
            menuStructure.push(gradeFolder);
            addLog(`📁 Vytvořena složka "${gradeName}"`);
          }
          
          // 3. Find or create topic folder
          let topicFolder = (gradeFolder.children || []).find((f: any) => f.label === selectedDataSet.topic);
          
          if (!topicFolder) {
            topicFolder = {
              id: `folder-${Date.now()}-${selectedDataSet.topic.toLowerCase().replace(/\s+/g, '-')}`,
              label: selectedDataSet.topic,
              slug: selectedDataSet.topic.toLowerCase().replace(/\s+/g, '-'),
              type: 'folder',
              icon: 'folder',
              children: [],
            };
            gradeFolder.children = gradeFolder.children || [];
            gradeFolder.children.push(topicFolder);
            addLog(`📁 Vytvořena složka "${selectedDataSet.topic}"`);
          }
          
          // 4. Add materials to topic folder
          topicFolder.children = topicFolder.children || [];
          let added = 0;
          
          const getDisplayName = (type: string, topic: string): string => {
            switch (type) {
              case 'text': return `${topic} - Učební text`;
              case 'board-easy': return `${topic} - Procvičování (úroveň 1)`;
              case 'board-hard': return `${topic} - Procvičování (úroveň 2)`;
              case 'worksheet': return `${topic} - Pracovní list`;
              case 'test': return `${topic} - Písemka`;
              case 'lesson': return `${topic} - Interaktivní lekce`;
              case 'lessons': return `${topic} - E-U-R lekce`;
              case 'methodology': return `${topic} - Metodická inspirace`;
              default: return `${topic} - ${type}`;
            }
          };
          
          const getMenuType = (matType: string): string => {
            if (matType === 'worksheet') return 'worksheet';
            if (matType === 'test') return 'test';
            if (matType === 'methodology') return 'methodology';
            if (matType === 'lesson' || matType === 'lessons') return 'interactive';
            if (matType.includes('board')) return 'practice';
            if (matType === 'text') return 'ucebni-text';
            return 'practice';
          };
          
          for (const mat of materials) {
            if (!mat.id) continue;
            
            const menuType = getMenuType(mat.type);
            const displayName = getDisplayName(mat.type, selectedDataSet.topic);
            
            const existingIndex = topicFolder.children.findIndex(
              (item: any) => item.type === menuType && item.label === displayName
            );
            
            const menuItem = {
              id: mat.id,
              label: displayName,
              slug: mat.id,
              type: menuType,
              icon: menuType,
            };
            
            if (existingIndex >= 0) {
              topicFolder.children[existingIndex] = menuItem;
            } else {
              topicFolder.children.push(menuItem);
              added++;
            }
          }
          
          // 5. Save menu structure
          addLog(`💾 Ukládám do knihovny (${added} položek)...`);
          const saveResp = await fetch(`https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ menu: menuStructure, category }),
          });
          
          if (!saveResp.ok) {
            throw new Error(`Chyba ukládání: ${await saveResp.text()}`);
          }
          
          // 6. Mark DataSet as published
          await supabase
            .from('topic_data_sets')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('id', selectedDataSet.id);
          
          setSelectedDataSet((prev: any) => ({ ...prev, status: 'published' }));
          
          toast.success(`Uloženo ${added} materiálů do knihovny!`);
          addLog(`🎉 Hotovo! Materiály jsou v admin knihovně`, 'success');
          
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Ukládání selhalo');
        } finally {
          setSavingMaterials(false);
        }
      };
      
      const handleDeleteMaterial = async (mat: any, idx: number) => {
        if (!confirm(`Opravdu smazat "${mat.title || mat.type}"?`)) return;
        
        const updatedMaterials = materials.filter((_: any, i: number) => i !== idx);
        
        // Update local state
        setSelectedDataSet((prev: any) => ({
          ...prev,
          generated_materials: updatedMaterials
        }));
        
        // Save to DB
        await supabase
          .from('topic_data_sets')
          .update({ generated_materials: updatedMaterials })
          .eq('id', selectedDataSet.id);
        
        toast.success('Materiál smazán');
        addLog(`🗑️ Smazán materiál: ${mat.title || mat.type}`, 'success');
      };
      
      const handleRegenerateMaterial = async (mat: any, idx: number) => {
        if (!materialFeedback.trim()) {
          toast.error('Zadej zpětnou vazbu pro AI');
          return;
        }
        
        setRegeneratingMaterialId(mat.id || `mat-${idx}`);
        addLog(`🔄 Přegenerovávám: ${mat.title || mat.type}...`);
        addLog(`📝 Feedback: ${materialFeedback}`);
        
        try {
          const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
          
          // Add user feedback to content for AI to consider
          const dataSet = {
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: {
              ...(selectedDataSet.content || {}),
              userFeedback: materialFeedback, // Pass feedback to generator
            },
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
          
          // Typ materiálu - generateFromDataSet očekává pomlčky
          const materialType = mat.type;
          
          const result = await generateFromDataSet(dataSet, materialType);
          console.log(`[CurriculumFactory] Regen ${materialType} result:`, result.success, result.id, result.error);
          
          // Generátor vrací { success, id, preview } - materiál už je uložen v DB!
          if (result.success && result.id) {
            const newMaterial = {
              id: result.id,
              type: mat.type,
              title: mat.title || `${selectedDataSet.topic} - ${mat.type}`,
              preview: result.preview,
              regeneratedAt: new Date().toISOString(),
            };
            
            // Replace old material with new one
            const updatedMaterials = [...materials];
            updatedMaterials[idx] = newMaterial;
            
            // Update local state
            setSelectedDataSet((prev: any) => ({
              ...prev,
              generated_materials: updatedMaterials
            }));
            
            // Save to DB
            await supabase
              .from('topic_data_sets')
              .update({ generated_materials: updatedMaterials })
              .eq('id', selectedDataSet.id);
            
            toast.success('Materiál přegenerován!');
            addLog(`✅ Přegenerováno: ${mat.title || mat.type}`, 'success');
          } else {
            throw new Error(result.error || 'Generování selhalo');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Přegenerování selhalo');
        } finally {
          setRegeneratingMaterialId(null);
          setShowFeedbackFor(null);
          setMaterialFeedback('');
        }
      };
      
      const MATERIAL_TYPES = [
        { type: 'text', label: 'Text', icon: '📝' },
        { type: 'board-easy', label: 'Board Easy', icon: '🎯' },
        { type: 'board-hard', label: 'Board Hard', icon: '🧠' },
        { type: 'worksheet', label: 'Pracovní list', icon: '📋' },
        { type: 'test', label: 'Test', icon: '✅' },
        { type: 'lessons', label: 'Lekce (E-U-R)', icon: '📚' },
        { type: 'methodology', label: 'Metodika', icon: '📖' },
      ];
      
      const handleGenerateSingleMaterial = async (materialType: string) => {
        setRegeneratingMaterialId(materialType);
        addLog(`⏳ Generuji: ${materialType}...`);
        try {
          const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Nejste přihlášeni');
          const dataSet = {
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: selectedDataSet.content || {},
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
          const result = await generateFromDataSet(dataSet, materialType);
          if (result.success && result.id) {
            const title = `${selectedDataSet.topic} - ${materialType}`;
            const newMaterial = { id: result.id, type: materialType, title, preview: result.preview, status: 'draft', createdAt: new Date().toISOString() };
            
            const { data: freshRow } = await supabase
              .from('topic_data_sets')
              .select('generated_materials')
              .eq('id', selectedDataSet.id)
              .single();
            const freshMaterials = freshRow?.generated_materials || [];
            const updatedMaterials = [...freshMaterials, newMaterial];
            
            const { error: saveErr } = await supabase
              .from('topic_data_sets')
              .update({ generated_materials: updatedMaterials })
              .eq('id', selectedDataSet.id);
            if (saveErr) console.error('[Materials] Save error:', saveErr);
            
            setSelectedDataSet((prev: any) => ({
              ...prev,
              generated_materials: updatedMaterials
            }));
            addLog(`✅ ${materialType} hotovo`, 'success');
            toast.success(`${materialType} vygenerováno!`);
          } else {
            addLog(`⚠️ ${materialType}: ${result.error || 'Neznámá chyba'}`, 'warning');
            toast.error(`${materialType}: ${result.error || 'Generování selhalo'}`);
          }
        } catch (err: any) {
          addLog(`❌ ${materialType} selhalo: ${err.message}`, 'error');
          toast.error(`${materialType} selhalo`);
        } finally {
          setRegeneratingMaterialId(null);
        }
      };
      
      const handleGenerateAll = async () => {
        setRegeneratingMaterialId('all');
        addLog('🚀 Generuji všechny materiály...');
        try {
          const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Nejste přihlášeni');
          const dataSet = {
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: selectedDataSet.content || {},
            media: selectedDataSet.media || {},
            generatedMaterials: [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
          const generatedMaterials: any[] = [];
          for (const { type } of MATERIAL_TYPES) {
            addLog(`⏳ Generuji: ${type}...`);
            try {
              const result = await generateFromDataSet(dataSet, type);
              if (result.success && result.id) {
                generatedMaterials.push({
                  id: result.id,
                  type,
                  title: `${selectedDataSet.topic} - ${type}`,
                  preview: result.preview,
                  status: 'draft',
                  createdAt: new Date().toISOString(),
                });
                addLog(`✅ ${type} hotovo`, 'success');
              } else {
                addLog(`⚠️ ${type}: ${result.error || 'Neznámá chyba'}`, 'warning');
              }
            } catch (err: any) {
              addLog(`❌ ${type} selhalo: ${err.message}`, 'error');
            }
          }
          setSelectedDataSet((prev: any) => ({ ...prev, generated_materials: generatedMaterials }));
          await supabase.from('topic_data_sets').update({ generated_materials: generatedMaterials }).eq('id', selectedDataSet.id);
          toast.success(`Vygenerováno ${generatedMaterials.length} materiálů!`);
          addLog(`🎉 Hotovo! ${generatedMaterials.length} materiálů`, 'success');
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setRegeneratingMaterialId(null);
        }
      };
      
      // Dva sloupce: 1) seznam materiálů + vygenerovat vše / chybějící, 2) detail vybraného + chat
      return (
        <>
          {/* Sloupec 1: Seznam materiálů */}
          <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 330 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-wrap gap-2">
              <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Materiály ({materials.length})</span>
              <div className="flex gap-1">
                <button
                  onClick={handleSaveToLibrary}
                  disabled={savingMaterials || materials.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: savingMaterials ? '#818cf8' : (selectedDataSet.status === 'published' ? '#22c55e' : '#4f46e5'),
                    color: 'white',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: savingMaterials ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    opacity: materials.length === 0 ? 0.5 : 1,
                  }}
                >
                  {savingMaterials ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {savingMaterials ? 'Ukládám...' : selectedDataSet.status === 'published' ? 'Uloženo' : 'Uložit do knihovny'}
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto py-1">
              {materials.map((mat: any, idx: number) => {
                const isSelected = selectedMaterialIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedMaterialIndex(idx)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                      ${isSelected ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500' : 'hover:bg-slate-50 text-slate-700'}
                    `}
                  >
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{mat.title || mat.type}</div>
                      <div className="text-xs text-slate-400">{mat.type}</div>
                    </div>
                    <span
                      className="shrink-0 px-2 py-0.5 text-xs rounded-full"
                      style={{
                        backgroundColor: mat.id ? '#dcfce7' : '#fef3c7',
                        color: mat.id ? '#166534' : '#92400e',
                      }}
                    >
                      {mat.id ? 'Uloženo' : '…'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
            {/* Chybějící materiály + Vygenerovat vše - bude doplněno níže v bloku Generování materiálů */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <p className="text-xs font-medium text-slate-500 mb-2">Generovat</p>
              <button
                onClick={handleGenerateAll}
                disabled={regeneratingMaterialId !== null}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: regeneratingMaterialId === 'all' ? '#818cf8' : '#4f46e5',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: regeneratingMaterialId !== null ? 'not-allowed' : 'pointer',
                  marginBottom: '8px',
                }}
              >
                {regeneratingMaterialId === 'all' ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                ) : (
                  <><Sparkles className="w-3 h-3" /> Vygenerovat vše</>
                )}
              </button>
              {(() => {
                const existingTypes = new Set(materials.map((m: any) => m.type));
                const missingTypes = MATERIAL_TYPES.filter(t => !existingTypes.has(t.type) && t.type !== 'lessons');
                const openLessonWizard = () => {
                  setLessonSuggestedTopics([
                    selectedDataSet.topic,
                    ...(selectedDataSet.rvp?.thematicArea ? [selectedDataSet.rvp.thematicArea] : []),
                    ...(selectedDataSet.content?.keyTerms?.map((t: any) => typeof t === 'string' ? t : t.term)?.filter(Boolean) || []).slice(0, 8),
                    ...(selectedDataSet.content?.keyFacts?.slice(0, 3) || []),
                  ].filter(Boolean));
                  setLessonSelectedTopics(new Set());
                  setLessonSelectedCompetencies(new Set());
                  setLessonSelectedFacts(new Set());
                  setLessonDescription('');
                  setLessonJustGenerated(false);
                  setLessonWizardOpen(true);
                };
                return (
                  <>
                    {missingTypes.length > 0 && (
                      <>
                        <p className="text-xs text-slate-500 mb-1">Chybějící:</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {missingTypes.map(({ type, label, icon }) => (
                            <button
                              key={type}
                              onClick={() => handleGenerateSingleMaterial(type)}
                              disabled={regeneratingMaterialId !== null}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: regeneratingMaterialId === type ? '#818cf8' : '#6366f1',
                                color: 'white',
                                fontSize: '11px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: regeneratingMaterialId !== null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {regeneratingMaterialId === type ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{icon}</span>}
                              + {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="text-xs text-slate-500 mb-1">Lekce (E-U-R):</p>
                    <button
                      onClick={openLessonWizard}
                      disabled={regeneratingMaterialId !== null}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: '#8b5cf6',
                        color: 'white',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: regeneratingMaterialId !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      📚 {materials.filter((m: any) => m.type === 'lessons').length > 0 ? 'Generovat další lekci' : 'Generovat lekci'}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Sloupec 2: Detail vybraného materiálu + chat */}
          {selectedMat && (
            <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 330 }}>
              <div className="px-4 py-3 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h3 className="font-semibold text-slate-800">{selectedMat.title || selectedMat.type}</h3>
                    <p className="text-xs text-slate-500">{selectedMat.type}</p>
                  </div>
                </div>
                <span
                  className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: selectedMat.id ? '#dcfce7' : '#fef3c7',
                    color: selectedMat.id ? '#166534' : '#92400e',
                  }}
                >
                  {selectedMat.id ? 'Uloženo' : 'Generuje se...'}
                </span>
              </div>
              <div className="p-3 border-b border-slate-100 flex gap-2">
                <button
                  onClick={() => handleOpenMaterial(selectedMat)}
                  disabled={!selectedMat.id}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: selectedMat.id ? '#3b82f6' : '#94a3b8',
                    color: 'white',
                    border: 'none',
                    cursor: selectedMat.id ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Eye className="w-4 h-4" />
                  Otevřít
                </button>
                <button
                  onClick={() => handleDeleteMaterial(selectedMat, selectedMaterialIndex!)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0 overflow-y-auto p-4">
                <div className="text-xs font-medium text-slate-600 mb-2">💬 Zpětná vazba pro přegenerování</div>
                <textarea
                  value={materialFeedback}
                  onChange={(e) => setMaterialFeedback(e.target.value)}
                  placeholder="Např: Chci víc interaktivních prvků, kratší texty, jednodušší jazyk..."
                  className="w-full p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
                  rows={4}
                />
                <button
                  onClick={() => handleRegenerateMaterial(selectedMat, selectedMaterialIndex!)}
                  disabled={!materialFeedback.trim() || regeneratingMaterialId === (selectedMat.id || `mat-${selectedMaterialIndex}`)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: (!materialFeedback.trim() || regeneratingMaterialId) ? '#a78bfa' : '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    cursor: (!materialFeedback.trim() || regeneratingMaterialId) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {regeneratingMaterialId === (selectedMat.id || `mat-${selectedMaterialIndex}`) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generuji...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Přegenerovat
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Sloupec 3: Wizard Lekce – návrh témat + chat pro popis */}
          {lessonWizardOpen && (
            <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 330 }}>
              <div className="px-4 py-3 border-b border-slate-200 bg-indigo-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Generovat lekci (E-U-R)
                  </h3>
                  <button
                    onClick={() => setLessonWizardOpen(false)}
                    className="p-1 rounded hover:bg-indigo-100 text-slate-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">Popiš lekci a vyber témata – podklady (kompetence a fakta) se berou z DataSetu.</p>
              </div>
              <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
                {/* Chat / popis lekce – nahoru */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Popis lekce (zpětná vazba pro AI):</p>
                  <textarea
                    value={lessonDescription}
                    onChange={(e) => setLessonDescription(e.target.value)}
                    placeholder="Např: Zaměř se na porovnání Athén a Sparty, důraz na E-U-R fáze, 2. stupeň ZŠ..."
                    className="w-full p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={4}
                  />
                </div>
                {/* Podklady: klíčové kompetence a klíčová fakta – stejný UX jako témata, v základu vše off */}
                {(() => {
                  const rvp = selectedDataSet.rvp as any;
                  const competencies = Array.isArray(rvp?.competencies) ? rvp.competencies : (Array.isArray(rvp?.keyCompetencies) ? rvp.keyCompetencies : []);
                  const keyFacts = selectedDataSet.content?.keyFacts || [];
                  return (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Klíčové kompetence:</p>
                        {competencies.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {competencies.map((c: string, i: number) => {
                              const isChecked = lessonSelectedCompetencies.has(i);
                              return (
                                <label
                                  key={i}
                                  className={`
                                    inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm break-words max-w-full
                                    ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600'}
                                  `}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setLessonSelectedCompetencies(prev => {
                                        const next = new Set(prev);
                                        if (next.has(i)) next.delete(i);
                                        else next.add(i);
                                        return next;
                                      });
                                    }}
                                    className="rounded border-slate-300 shrink-0"
                                  />
                                  <span>{c}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">V DataSetu nejsou vyplněné kompetence.</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Klíčová fakta:</p>
                        {keyFacts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {keyFacts.map((f: string, i: number) => {
                              const isChecked = lessonSelectedFacts.has(i);
                              return (
                                <label
                                  key={i}
                                  className={`
                                    inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm break-words max-w-full
                                    ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600'}
                                  `}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setLessonSelectedFacts(prev => {
                                        const next = new Set(prev);
                                        if (next.has(i)) next.delete(i);
                                        else next.add(i);
                                        return next;
                                      });
                                    }}
                                    className="rounded border-slate-300 shrink-0"
                                  />
                                  <span>{f}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">V DataSetu nejsou vyplněná fakta.</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Navržená témata z DataSetu:</p>
                        <div className="flex flex-wrap gap-2">
                          {lessonSuggestedTopics.map((topic: string) => {
                            const isChecked = lessonSelectedTopics.has(topic);
                            return (
                              <label
                                key={topic}
                                className={`
                                  inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm break-words max-w-full
                                  ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600'}
                                `}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setLessonSelectedTopics(prev => {
                                      const next = new Set(prev);
                                      if (next.has(topic)) next.delete(topic);
                                      else next.add(topic);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-slate-300 shrink-0"
                                />
                                <span>{topic}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {lessonJustGenerated ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                      ✓ Lekce přidána do seznamu. Vygeneruj další nebo zavři.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setLessonJustGenerated(false);
                          setLessonDescription('');
                          setLessonSelectedTopics(new Set());
                          setLessonSelectedCompetencies(new Set());
                          setLessonSelectedFacts(new Set());
                        }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: '#6366f1',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Sparkles className="w-4 h-4" />
                        Generovat další lekci
                      </button>
                      <button
                        onClick={() => {
                          setLessonWizardOpen(false);
                          setLessonJustGenerated(false);
                        }}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: '#64748b',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Hotovo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setGeneratingLesson(true);
                      addLog('⏳ Generuji lekci (E-U-R)...');
                      try {
                        const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
                        const rvpPayload = selectedDataSet.rvp as any;
                        const competenciesPayload = Array.isArray(rvpPayload?.competencies) ? rvpPayload.competencies : (Array.isArray(rvpPayload?.keyCompetencies) ? rvpPayload.keyCompetencies : []);
                        const keyFactsPayload = selectedDataSet.content?.keyFacts || [];
                        const dataSet = {
                          id: selectedDataSet.id,
                          topic: selectedDataSet.topic,
                          subjectCode: selectedDataSet.subject_code,
                          grade: selectedDataSet.grade,
                          status: selectedDataSet.status,
                          rvp: {
                            ...(selectedDataSet.rvp || {}),
                            competencies: lessonSelectedCompetencies.size > 0
                              ? competenciesPayload.filter((_: string, i: number) => lessonSelectedCompetencies.has(i))
                              : [],
                          },
                          targetGroup: {},
                          content: {
                            ...(selectedDataSet.content || {}),
                            keyFacts: lessonSelectedFacts.size > 0
                              ? keyFactsPayload.filter((_: string, i: number) => lessonSelectedFacts.has(i))
                              : [],
                            lessonBrief: lessonDescription || undefined,
                            lessonTopics: Array.from(lessonSelectedTopics),
                          },
                          media: selectedDataSet.media || {},
                          generatedMaterials: selectedDataSet.generated_materials || [],
                          createdAt: selectedDataSet.created_at,
                          updatedAt: selectedDataSet.updated_at,
                        };
                        const result = await generateFromDataSet(dataSet, 'lessons');
                        if (result.success && result.id) {
                          const lessonCount = (selectedDataSet.generated_materials || []).filter((m: any) => m.type === 'lessons').length + 1;
                          const subtitle = result.preview?.split('\n')[1]?.replace(/^\d+\.\s*/, '').split(' (')[0]?.trim();
                          const newMaterial = {
                            id: result.id,
                            type: 'lessons',
                            title: subtitle ? `${selectedDataSet.topic} - ${subtitle}` : `${selectedDataSet.topic} - Lekce (E-U-R) ${lessonCount}`,
                            preview: result.preview,
                            status: 'draft',
                            createdAt: new Date().toISOString(),
                          };
                          
                          const { data: freshRow } = await supabase
                            .from('topic_data_sets')
                            .select('generated_materials')
                            .eq('id', selectedDataSet.id)
                            .single();
                          const freshMaterials = freshRow?.generated_materials || [];
                          const updatedMaterials = [...freshMaterials, newMaterial];
                          
                          const { error: saveErr } = await supabase
                            .from('topic_data_sets')
                            .update({ generated_materials: updatedMaterials })
                            .eq('id', selectedDataSet.id);
                          if (saveErr) console.error('[Lessons] Save error:', saveErr);
                          
                          setSelectedDataSet((prev: any) => ({
                            ...prev,
                            generated_materials: updatedMaterials
                          }));
                          setLessonJustGenerated(true);
                          addLog('✅ Lekce vygenerována', 'success');
                          toast.success('Lekce přidána. Můžeš vygenerovat další.');
                        } else {
                          throw new Error(result.error || 'Generování selhalo');
                        }
                      } catch (err: any) {
                        addLog(`❌ Lekce: ${err.message}`, 'error');
                        toast.error(err.message);
                      } finally {
                        setGeneratingLesson(false);
                      }
                    }}
                    disabled={generatingLesson}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: generatingLesson ? '#a78bfa' : '#6366f1',
                      color: 'white',
                      border: 'none',
                      cursor: generatingLesson ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generatingLesson ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generuji lekci...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Generovat lekci</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      );
    }
    
    return (
      <div className="p-4 text-slate-400 text-center">
        Sekce "{section}" - TODO
      </div>
    );
  };
  
  // =====================================================
  // RENDER
  // =====================================================
  
  return (
    <div className="flex h-screen bg-slate-100 overflow-x-auto">
      {/* Console (collapsible) */}
      <Console 
        logs={logs} 
        isOpen={consoleOpen} 
        onToggle={() => setConsoleOpen(!consoleOpen)} 
      />
      
      {/* Settings Column */}
      <SettingsColumn
        selectedSubject={selectedSubject}
        selectedGrade={selectedGrade}
        onSubjectChange={setSelectedSubject}
        onGradeChange={setSelectedGrade}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onAgentSelect={(agent) => setSelectedAgentId(agent.id)}
        onRunPipeline={runPipeline}
        isRunning={isRunning}
      />
      
      {/* Agent Output Column */}
      {selectedAgentId && (
        <Column
          title={agents.find(a => a.id === selectedAgentId)?.name || 'Výstup'}
          items={getAgentOutputItems()}
          selectedId={selectedDataSet?.id || null}
          onSelect={(item) => {
            setSelectedDataSet(item.data);
            setSelectedDataSetSection(null);
          }}
          loading={dataSetsLoading}
          emptyMessage="Žádná data"
          badge={getAgentOutputItems().length}
        />
      )}
      
      {/* DataSet Sections Column */}
      {selectedDataSet && (
        <Column
          title={selectedDataSet.topic}
          items={getDataSetSections()}
          selectedId={selectedDataSetSection}
          onSelect={(item) => setSelectedDataSetSection(item.id)}
          emptyMessage="Žádné sekce"
        />
      )}
      
      {/* Section Detail (nebo při Materiály dva sloupce: seznam + detail) */}
      {selectedDataSetSection && selectedDataSetSection !== 'materials' && (
        <div className="bg-white overflow-y-auto flex-shrink-0" style={{ width: 330 }}>
          {getSectionDetail()}
        </div>
      )}
      {selectedDataSetSection === 'materials' && getSectionDetail()}
      
      {/* Empty state */}
      {!selectedAgentId && (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">Curriculum Factory</h2>
            <p className="text-slate-400 max-w-md">
              Vyberte předmět a ročník, pak klikněte na agenta pro zobrazení jeho výstupu.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CurriculumFactoryV2;
