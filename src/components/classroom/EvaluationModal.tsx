/**
 * EvaluationModal - Create and manage periodic student evaluations
 * 
 * Allows teachers to:
 * - Create evaluation periods (semester, final, etc.)
 * - Add notes for AI generation
 * - Generate AI evaluations
 * - Edit and send evaluations to students
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  FileText,
  Check,
  AlertCircle,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import {
  ClassEvaluation,
  StudentEvaluation,
  createClassEvaluation,
  initializeStudentEvaluations,
  getEvaluationWithStudents,
  updateTeacherInput,
  saveGeneratedEvaluation,
  updateFinalText,
  sendEvaluation,
} from '../../utils/class-evaluations';

interface StudentResult {
  title: string;
  score: number;
  maxScore: number;
  percentage: number;
  date: string;
  type: string;
}

interface Student {
  id: string;
  name: string;
  initials?: string;
  color?: string;
  averageScore: number;
  resultsCount: number;
  // Detailed data for richer evaluation
  bestResult?: StudentResult;
  worstResult?: StudentResult;
  recentResults?: StudentResult[];
  trend?: 'improving' | 'declining' | 'stable';
  strongAreas?: string[];
  weakAreas?: string[];
}

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  students: Student[];
  existingEvaluationId?: string;
  onEvaluationSent?: () => void;
}

type Step = 'setup' | 'materials' | 'prepare' | 'generate' | 'review' | 'sent';

const PERIOD_TYPES = [
  { value: 'semester', label: 'Pololetní hodnocení' },
  { value: 'final', label: 'Závěrečné hodnocení' },
  { value: 'quarterly', label: 'Čtvrtletní hodnocení' },
  { value: 'custom', label: 'Vlastní období' },
] as const;

function getScoreColor(score: number): string {
  if (score >= 90) return '#10B981';
  if (score >= 70) return '#84CC16';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return '#D1FAE5';
  if (score >= 70) return '#ECFCCB';
  if (score >= 50) return '#FEF3C7';
  return '#FEE2E2';
}

export function EvaluationModal({
  isOpen,
  onClose,
  classId,
  className,
  students,
  existingEvaluationId,
  onEvaluationSent,
}: EvaluationModalProps) {
  const [step, setStep] = useState<Step>('setup');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup form
  const [title, setTitle] = useState('Pololetní hodnocení');
  const [periodType, setPeriodType] = useState<'semester' | 'final' | 'quarterly' | 'custom'>('semester');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Evaluation data
  const [evaluation, setEvaluation] = useState<ClassEvaluation | null>(null);
  const [studentEvaluations, setStudentEvaluations] = useState<Map<string, StudentEvaluation>>(new Map());
  const [teacherInputs, setTeacherInputs] = useState<Map<string, string>>(new Map());
  const [generatedTexts, setGeneratedTexts] = useState<Map<string, string>>(new Map());
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  
  // Selected inspiration tags per student: Map<studentId, Set<tagText>>
  const [selectedTags, setSelectedTags] = useState<Map<string, Set<string>>>(new Map());
  
  // Materials - general instructions and ŠVP
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [svpText, setSvpText] = useState('');

  // Load existing evaluation
  useEffect(() => {
    if (existingEvaluationId && isOpen) {
      loadExistingEvaluation(existingEvaluationId);
    }
  }, [existingEvaluationId, isOpen]);

  async function loadExistingEvaluation(evalId: string) {
    setLoading(true);
    try {
      const { evaluation: eval_, studentEvaluations: stuEvals } = await getEvaluationWithStudents(evalId);
      if (eval_) {
        setEvaluation(eval_);
        setTitle(eval_.title);
        setPeriodType(eval_.period_type as any);
        setDateFrom(eval_.date_from || '');
        setDateTo(eval_.date_to || '');

        const evalMap = new Map<string, StudentEvaluation>();
        const inputMap = new Map<string, string>();
        const textMap = new Map<string, string>();

        stuEvals.forEach(se => {
          evalMap.set(se.student_id, se);
          if (se.teacher_input) inputMap.set(se.student_id, se.teacher_input);
          if (se.final_text) textMap.set(se.student_id, se.final_text);
        });

        setStudentEvaluations(evalMap);
        setTeacherInputs(inputMap);
        setGeneratedTexts(textMap);

        if (eval_.status === 'sent') {
          setStep('sent');
        } else if (textMap.size > 0) {
          setExpandedStudent(students[0]?.id || null);
          setStep('review');
        } else {
          setStep('prepare');
        }
      }
    } catch (e) {
      console.error('Error loading evaluation:', e);
      setError('Nepodařilo se načíst hodnocení');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvaluation() {
    setLoading(true);
    setError(null);

    try {
      const newEval = await createClassEvaluation({
        classId,
        title,
        periodType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      if (!newEval) {
        setError('Nepodařilo se vytvořit hodnocení');
        return;
      }

      setEvaluation(newEval);

      // Initialize student evaluations
      const studentData = students.map(s => ({
        id: s.id,
        name: s.name,
        averageScore: s.averageScore,
        resultsCount: s.resultsCount,
      }));

      const success = await initializeStudentEvaluations(newEval.id, classId, studentData);
      if (!success) {
        setError('Nepodařilo se inicializovat hodnocení studentů');
        return;
      }

      // Reload to get student evaluation IDs
      const { studentEvaluations: stuEvals } = await getEvaluationWithStudents(newEval.id);
      const evalMap = new Map<string, StudentEvaluation>();
      stuEvals.forEach(se => evalMap.set(se.student_id, se));
      setStudentEvaluations(evalMap);

      setStep('materials');
    } catch (e) {
      console.error('Error creating evaluation:', e);
      setError('Nastala chyba při vytváření hodnocení');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateAll() {
    if (!evaluation) return;
    setGenerating(true);
    setError(null);

    try {
      const newTexts = new Map(generatedTexts);

      for (const student of students) {
        const stuEval = studentEvaluations.get(student.id);
        if (!stuEval) continue;

        const teacherInput = teacherInputs.get(student.id) || '';
        
        // Save teacher input first
        if (teacherInput) {
          await updateTeacherInput(stuEval.id, teacherInput);
        }

        // Generate AI evaluation
        const generatedText = await generateStudentEvaluation(
          student.name,
          student.averageScore,
          student.resultsCount,
          teacherInput,
          title,
          periodType,
          student,
          generalInstructions,
          svpText
        );

        // Save to database
        await saveGeneratedEvaluation(stuEval.id, generatedText);
        newTexts.set(student.id, generatedText);
      }

      setGeneratedTexts(newTexts);
      setExpandedStudent(students[0]?.id || null);
      setStep('review');
    } catch (e) {
      console.error('Error generating evaluations:', e);
      setError('Nastala chyba při generování hodnocení');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerateOne(studentId: string) {
    const student = students.find(s => s.id === studentId);
    const stuEval = studentEvaluations.get(studentId);
    if (!student || !stuEval) return;

    setGenerating(true);
    try {
      // Combine: teacher input from prepare step + selected tags
      let teacherInput = teacherInputs.get(studentId) || '';
      
      // Add selected inspiration tags
      const studentTags = selectedTags.get(studentId);
      if (studentTags && studentTags.size > 0) {
        const tagsText = Array.from(studentTags).join(' ');
        teacherInput = teacherInput ? `${teacherInput} ${tagsText}` : tagsText;
      }
      
      const generatedText = await generateStudentEvaluation(
        student.name,
        student.averageScore,
        student.resultsCount,
        teacherInput,
        title,
        periodType,
        student,
        generalInstructions,
        svpText
      );

      await saveGeneratedEvaluation(stuEval.id, generatedText);
      setGeneratedTexts(new Map(generatedTexts).set(studentId, generatedText));
    } catch (e) {
      console.error('Error regenerating evaluation:', e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateText(studentId: string, text: string) {
    const stuEval = studentEvaluations.get(studentId);
    if (!stuEval) return;

    setGeneratedTexts(new Map(generatedTexts).set(studentId, text));
    await updateFinalText(stuEval.id, text);
  }

  async function handleSendEvaluations() {
    if (!evaluation) return;
    setSending(true);
    setError(null);

    try {
      const success = await sendEvaluation(evaluation.id);
      if (success) {
        setStep('sent');
        onEvaluationSent?.();
      } else {
        setError('Nepodařilo se odeslat hodnocení');
      }
    } catch (e) {
      console.error('Error sending evaluations:', e);
      setError('Nastala chyba při odesílání hodnocení');
    } finally {
      setSending(false);
    }
  }

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('setup');
      setEvaluation(null);
      setStudentEvaluations(new Map());
      setTeacherInputs(new Map());
      setGeneratedTexts(new Map());
      setError(null);
      setExpandedStudent(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {step === 'setup' && 'Nové hodnocení'}
                {step === 'prepare' && 'Příprava hodnocení'}
                {step === 'generate' && 'Generování hodnocení'}
                {step === 'review' && 'Kontrola hodnocení'}
                {step === 'sent' && 'Hodnocení odesláno'}
              </h2>
              <p className="text-sm text-slate-500">{className}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            {(['setup', 'materials', 'prepare', 'review', 'sent'] as const).map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 ${
                  step === s ? 'text-indigo-600' :
                  ['setup', 'materials', 'prepare', 'review', 'sent'].indexOf(step) > i ? 'text-emerald-600' :
                  'text-slate-400'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s ? 'bg-indigo-600 text-white' :
                    ['setup', 'materials', 'prepare', 'review', 'sent'].indexOf(step) > i ? 'bg-emerald-500 text-white' :
                    'bg-slate-200 text-slate-500'
                  }`}>
                    {['setup', 'materials', 'prepare', 'review', 'sent'].indexOf(step) > i ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">
                    {s === 'setup' && 'Nastavení'}
                    {s === 'materials' && 'Podklady'}
                    {s === 'prepare' && 'Příprava'}
                    {s === 'review' && 'Kontrola'}
                    {s === 'sent' && 'Odesláno'}
                  </span>
                </div>
                {i < 4 && <div className="flex-1 h-0.5 bg-slate-200 hidden sm:block" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          )}

          {/* Step: Setup */}
          {step === 'setup' && !loading && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Název hodnocení
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="např. Pololetní hodnocení 2024/25"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Období hodnocení
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Poslední měsíc', months: 1 },
                    { label: 'Poslední 2 měsíce', months: 2 },
                    { label: 'Poslední 3 měsíce', months: 3 },
                    { label: 'Poslední pololetí', months: 6 },
                    { label: 'Celý rok', months: 12 },
                    { label: 'Vše', months: 0 },
                  ].map(period => {
                    const isSelected = (() => {
                      if (period.months === 0) return !dateFrom && !dateTo;
                      const expectedFrom = new Date();
                      expectedFrom.setMonth(expectedFrom.getMonth() - period.months);
                      return dateFrom === expectedFrom.toISOString().split('T')[0];
                    })();
                    
                    return (
                      <button
                        key={period.months}
                        onClick={() => {
                          if (period.months === 0) {
                            setDateFrom('');
                            setDateTo('');
                          } else {
                            const from = new Date();
                            from.setMonth(from.getMonth() - period.months);
                            setDateFrom(from.toISOString().split('T')[0]);
                            setDateTo(new Date().toISOString().split('T')[0]);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        {period.label}
                      </button>
                    );
                  })}
                </div>
                {dateFrom && (
                  <p className="mt-2 text-xs text-slate-500">
                    Období: {new Date(dateFrom).toLocaleDateString('cs-CZ')} – {dateTo ? new Date(dateTo).toLocaleDateString('cs-CZ') : 'dnes'}
                  </p>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>{students.length} studentů</strong> bude zahrnuto do tohoto hodnocení
                </p>
              </div>
            </div>
          )}

          {/* Step: Materials - General instructions and ŠVP */}
          {step === 'materials' && !loading && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Moje podklady</h3>
                <p className="text-sm text-slate-600">
                  Zde můžete zadat obecné pokyny pro generování hodnocení a nahrát text ŠVP pro hodnocení podle vzdělávacích cílů.
                </p>
              </div>
              
              {/* General instructions */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  📝 Obecné instrukce pro hodnocení
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Zadejte pokyny jak má AI psát hodnocení - na co se zaměřit, jakým stylem psát, co zdůraznit, atd.
                </p>
                <textarea
                  value={generalInstructions}
                  onChange={(e) => setGeneralInstructions(e.target.value)}
                  placeholder="Např.: Hodnocení piš pozitivně a motivačně. Zaměř se na pokrok žáka. Zmiň konkrétní příklady z hodin. Vyzdvihni snahu a aktivitu..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  rows={4}
                />
              </div>
              
              {/* ŠVP */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  📚 ŠVP - Školní vzdělávací program (volitelné)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Vložte text z vašeho ŠVP s očekávanými výstupy a cíli pro daný předmět/období. 
                  AI pak bude hodnotit i podle toho, jak žák dosahuje těchto cílů.
                </p>
                <textarea
                  value={svpText}
                  onChange={(e) => setSvpText(e.target.value)}
                  placeholder="Např.: Očekávané výstupy pro 6. ročník - Matematika:
- Žák provádí početní operace v oboru celých a racionálních čísel
- Žák řeší modelováním a výpočtem situace vyjádřené poměrem
- Žák analyzuje a řeší jednoduché problémy, modeluje konkrétní situace..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
                  rows={8}
                />
              </div>
              
              {/* Tips */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#EEF2FF' }}>
                <h4 className="font-medium text-indigo-800 mb-2">💡 Tipy pro kvalitní podklady:</h4>
                <ul className="text-sm text-indigo-700 space-y-1">
                  <li>• Zadejte konkrétní pokyny pro styl a tón hodnocení</li>
                  <li>• Uveďte, zda preferujete formální nebo neformální oslovení</li>
                  <li>• ŠVP pomůže hodnotit podle skutečných vzdělávacích cílů školy</li>
                  <li>• Tato nastavení se použijí pro všechny studenty</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step: Prepare - Add teacher inputs */}
          {step === 'prepare' && !loading && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Pro každého studenta můžete přidat poznámky, ze kterých AI vygeneruje hodnocení.
                Pokud poznámku nepřidáte, AI vytvoří hodnocení pouze na základě výsledků.
              </p>

              {students.map(student => {
                const isExpanded = expandedStudent === student.id;
                return (
                  <div
                    key={student.id}
                    className="border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: student.color || '#6366F1' }}
                        >
                          {student.initials || student.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-slate-800">{student.name}</div>
                          <div className="text-sm text-slate-500">
                            {student.resultsCount} výsledků
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="px-3 py-1 rounded-full text-sm font-bold"
                          style={{
                            backgroundColor: getScoreBgColor(student.averageScore),
                            color: getScoreColor(student.averageScore),
                          }}
                        >
                          {student.averageScore}%
                        </div>
                        {teacherInputs.get(student.id) && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500" title="Poznámka přidána" />
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-slate-100">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Poznámky pro AI (volitelné)
                        </label>
                        <textarea
                          value={teacherInputs.get(student.id) || ''}
                          onChange={(e) => {
                            setTeacherInputs(new Map(teacherInputs).set(student.id, e.target.value));
                          }}
                          placeholder="např. Výborná aktivita v hodinách, potřebuje zlepšit práci s grafy..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step: Review - Two column layout */}
          {step === 'review' && !loading && (
            <div className="flex gap-4 h-[500px]">
              {/* Left column - Student list */}
              <div className="w-64 shrink-0 border-r border-slate-200 pr-4 overflow-y-auto">
                <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide font-medium">
                  Studenti ({students.length})
                </p>
                <div className="space-y-1">
                  {students.map(student => {
                    const text = generatedTexts.get(student.id) || '';
                    const isSelected = expandedStudent === student.id;
                    const hasWarning = text.startsWith('⚠️');
                    const hasContent = text && !hasWarning;
                    
                    return (
                      <button
                        key={student.id}
                        onClick={() => setExpandedStudent(student.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                          isSelected 
                            ? 'bg-indigo-50 border border-indigo-200' 
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ backgroundColor: student.color || '#6366F1' }}
                        >
                          {student.initials || student.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 text-sm truncate">
                            {student.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {student.averageScore}% • {student.resultsCount} aktivit
                          </div>
                        </div>
                        <div className="shrink-0">
                          {hasContent ? (
                            <Check className="w-5 h-5" style={{ color: '#10B981' }} />
                          ) : hasWarning ? (
                            <div 
                              className="w-7 h-7 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: '#F59E0B', animation: 'pulse 2s infinite' }}
                            >
                              <AlertCircle className="w-5 h-5" style={{ color: 'white' }} />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full" style={{ border: '2px solid #CBD5E1' }} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Right column - Evaluation detail */}
              <div className="flex-1 overflow-y-auto">
                {expandedStudent ? (() => {
                  const student = students.find(s => s.id === expandedStudent);
                  if (!student) return null;
                  const text = generatedTexts.get(student.id) || '';
                  const hasWarning = text.startsWith('⚠️');
                  
                  return (
                    <div className="space-y-4">
                      {/* Student header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: student.color || '#6366F1' }}
                          >
                            {student.initials || student.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-800 text-lg">{student.name}</h3>
                            <div className="flex items-center gap-3 text-sm text-slate-500">
                              <span>Průměr: <strong style={{ color: getScoreColor(student.averageScore) }}>{student.averageScore}%</strong></span>
                              <span>•</span>
                              <span>{student.resultsCount} aktivit</span>
                              {student.trend && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {student.trend === 'improving' && '📈 Zlepšuje se'}
                                    {student.trend === 'declining' && '📉 Klesá'}
                                    {student.trend === 'stable' && '➡️ Stabilní'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRegenerateOne(student.id)}
                          disabled={generating}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                          Přegenerovat
                        </button>
                      </div>
                      
                      {/* Warning if not enough data */}
                      {hasWarning && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-sm text-amber-800">
                            {text.replace('⚠️ ', '')}
                          </p>
                        </div>
                      )}
                      
                      {/* Evaluation textarea */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          {hasWarning ? 'Napište hodnocení:' : 'Text hodnocení'}
                        </label>
                        <textarea
                          value={hasWarning ? '' : text}
                          onChange={(e) => handleUpdateText(student.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed"
                          rows={12}
                          placeholder={hasWarning ? 'Napište zde hodnocení pro tohoto žáka...' : ''}
                        />
                      </div>
                      
                      {/* Inspiration hints - checkboxes */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between pt-3">
                          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                            Naklikejte čím chcete hodnocení doplnit
                          </p>
                          {(selectedTags.get(student.id)?.size || 0) > 0 && (
                            <span className="text-xs text-indigo-600 font-medium">
                              Vybráno: {selectedTags.get(student.id)?.size || 0}
                            </span>
                          )}
                        </div>
                        
                        {/* Positive */}
                        <div>
                          <p className="text-sm font-medium mb-2" style={{ color: '#10B981' }}>✨ Pozitivní:</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              'Je snaživý/á a pečlivý/á.',
                              'Aktivně se zapojuje do výuky.',
                              'Spolupracuje se spolužáky.',
                              'Pomáhá ostatním.',
                              'Zvládá práci samostatně.',
                              'Má kreativní přístup.',
                              'Je zodpovědný/á.',
                              'Zlepšil/a se oproti minulému období.',
                              'Projevuje zájem o učivo.',
                              'Pečlivě plní zadané úkoly.',
                            ].map((hint, i) => {
                              const studentTags = selectedTags.get(student.id) || new Set();
                              const isSelected = studentTags.has(hint);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    const newTags = new Set(studentTags);
                                    if (isSelected) {
                                      newTags.delete(hint);
                                    } else {
                                      newTags.add(hint);
                                    }
                                    setSelectedTags(new Map(selectedTags).set(student.id, newTags));
                                  }}
                                  style={isSelected 
                                    ? { backgroundColor: '#10B981', color: 'white' } 
                                    : { backgroundColor: '#D1FAE5', color: '#047857' }
                                  }
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-all hover:opacity-80"
                                >
                                  <div 
                                    style={isSelected 
                                      ? { borderColor: 'white', backgroundColor: 'white' } 
                                      : { borderColor: '#34D399' }
                                    }
                                    className="w-4 h-4 rounded border-2 flex items-center justify-center"
                                  >
                                    {isSelected && <Check className="w-3 h-3" style={{ color: '#10B981' }} />}
                                  </div>
                                  {hint.replace('.', '')}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Areas for improvement */}
                        <div>
                          <p className="text-sm font-medium mb-2" style={{ color: '#64748B' }}>📝 Oblasti ke zlepšení:</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              'Potřebuje více času na pochopení.',
                              'Potřebuje více procvičovat.',
                              'Měl/a by se více soustředit.',
                              'Doporučuji pravidelnou přípravu.',
                              'Měl/a by se nebát zeptat.',
                              'Potřebuje podporu při složitějších úlohách.',
                              'Občas pracuje nepozorně.',
                              'Měl/a by více spolupracovat s ostatními.',
                            ].map((hint, i) => {
                              const studentTags = selectedTags.get(student.id) || new Set();
                              const isSelected = studentTags.has(hint);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    const newTags = new Set(studentTags);
                                    if (isSelected) {
                                      newTags.delete(hint);
                                    } else {
                                      newTags.add(hint);
                                    }
                                    setSelectedTags(new Map(selectedTags).set(student.id, newTags));
                                  }}
                                  style={isSelected 
                                    ? { backgroundColor: '#475569', color: 'white' } 
                                    : { backgroundColor: '#F1F5F9', color: '#475569' }
                                  }
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-all hover:opacity-80"
                                >
                                  <div 
                                    style={isSelected 
                                      ? { borderColor: 'white', backgroundColor: 'white' } 
                                      : { borderColor: '#94A3B8' }
                                    }
                                    className="w-4 h-4 rounded border-2 flex items-center justify-center"
                                  >
                                    {isSelected && <Check className="w-3 h-3" style={{ color: '#475569' }} />}
                                  </div>
                                  {hint.replace('.', '')}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Vyberte studenta ze seznamu</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Sent */}
          {step === 'sent' && !loading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Hodnocení úspěšně odesláno!
              </h3>
              <p className="text-slate-600 mb-6">
                {students.length} studentů obdrželo své hodnocení.
                Zobrazí se jim na jejich zdi a ve výsledcích.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Zavřít
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'sent' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => {
                if (step === 'materials') setStep('setup');
                else if (step === 'prepare') setStep('materials');
                else if (step === 'review') setStep('prepare');
                else onClose();
              }}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              {step === 'setup' ? 'Zrušit' : 'Zpět'}
            </button>

            <div className="flex items-center gap-3">
              {step === 'setup' && (
                <button
                  onClick={handleCreateEvaluation}
                  disabled={loading || !title.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Pokračovat
                </button>
              )}

              {step === 'materials' && (
                <button
                  onClick={() => setStep('prepare')}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Pokračovat
                </button>
              )}

              {step === 'prepare' && (
                <button
                  onClick={handleGenerateAll}
                  disabled={generating}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generating ? 'Generuji...' : 'Generovat hodnocení'}
                </button>
              )}

              {step === 'review' && (
                <button
                  onClick={handleSendEvaluations}
                  disabled={sending}
                  style={{ backgroundColor: '#10B981', color: 'white' }}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sending ? 'Odesílám...' : 'Odeslat studentům'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Detect gender from Czech first name
 * Female names typically end with: -a, -e, -ie
 */
function isFemale(firstName: string): boolean {
  const name = firstName.toLowerCase().trim();
  // Common female endings in Czech
  if (name.endsWith('a') || name.endsWith('e') || name.endsWith('ie')) {
    // Exceptions - male names ending with 'a'
    const maleExceptions = ['honza', 'jirka', 'péťa', 'miša', 'saša', 'nikita'];
    return !maleExceptions.includes(name);
  }
  return false;
}

/**
 * Convert Czech first name to vocative case (5. pád - oslovení)
 * Milý Petr -> Milý Petře, Milá Kateřina -> Milá Kateřino
 */
function toVocative(firstName: string, female: boolean): string {
  const name = firstName.trim();
  const nameLower = name.toLowerCase();
  
  if (female) {
    // Female names ending in -a -> -o (Kateřina -> Kateřino, Jana -> Jano)
    if (nameLower.endsWith('a')) {
      return name.slice(0, -1) + 'o';
    }
    // Female names ending in -e/-ie stay the same (Marie -> Marie)
    return name;
  } else {
    // Male names - more complex rules
    // Names ending in -r -> -ře (Petr -> Petře)
    if (nameLower.endsWith('r')) {
      return name + 'e';
    }
    // Names ending in -k -> -ku (Marek -> Marku, Patrik -> Patriku)  
    if (nameLower.endsWith('k')) {
      return name + 'u';
    }
    // Names ending in -l -> -le (Pavel -> Pavle, Karel -> Karle)
    if (nameLower.endsWith('l')) {
      return name + 'e';
    }
    // Names ending in -n -> -ne (Jan -> Jane, Martin -> Martine)
    if (nameLower.endsWith('n')) {
      return name + 'e';
    }
    // Names ending in -m -> -me (Adam -> Adame)
    if (nameLower.endsWith('m')) {
      return name + 'e';
    }
    // Names ending in -š -> -ši (Lukáš -> Lukáši, Tomáš -> Tomáši)
    if (nameLower.endsWith('š')) {
      return name + 'i';
    }
    // Names ending in -ek -> drop e, add -u (Vojtěch -> Vojtěchu but handled by -ch)
    // Names ending in -ch -> -chu (Vojtěch -> Vojtěchu)
    if (nameLower.endsWith('ch')) {
      return name + 'u';
    }
    // Names ending in -c -> -ci (Franc -> Franci)
    if (nameLower.endsWith('c')) {
      return name + 'i';
    }
    // Names ending in -j -> -ji (Ondřej -> Ondřeji)
    if (nameLower.endsWith('j')) {
      return name + 'i';
    }
    // Names ending in -a (male, like Honza, Jirka) -> -o
    if (nameLower.endsWith('a')) {
      return name.slice(0, -1) + 'o';
    }
    // Default - add -e
    return name + 'e';
  }
}

/**
 * Generate comprehensive formative evaluation for a student
 * - Written in 2nd person (directly addressing the student)
 * - Gender-aware conjugation
 * - Struktura: Oslovení → Přehled → Silné stránky → Oblasti ke zlepšení → Doporučení → Závěr
 */
async function generateStudentEvaluation(
  studentName: string,
  averageScore: number,
  resultsCount: number,
  teacherInput: string,
  evaluationTitle: string,
  periodType: string,
  studentData?: Student,
  generalInstructions?: string,
  svpText?: string
): Promise<string> {
  const firstName = studentName.split(' ')[0];
  const female = isFemale(firstName);
  const firstNameVocative = toVocative(firstName, female);
  
  // Gender-aware verb forms
  const g = {
    // Past tense
    dosahl: female ? 'dosáhla' : 'dosáhl',
    podal: female ? 'podala' : 'podal',
    pracoval: female ? 'pracovala' : 'pracoval',
    celil: female ? 'čelila' : 'čelil',
    potreboval: female ? 'potřebovala' : 'potřeboval',
    projevil: female ? 'projevila' : 'projevil',
    odvedl: female ? 'odvedla' : 'odvedl',
    zlepsil: female ? 'zlepšila' : 'zlepšil',
    // Adjectives
    snaziva: female ? 'snaživá' : 'snaživý',
    zodpovedna: female ? 'zodpovědná' : 'zodpovědný',
    schopna: female ? 'schopná' : 'schopný',
    // Nouns
    zak: female ? 'žákyně' : 'žák',
    // Oslovení
    mily: female ? 'Milá' : 'Milý',
  };
  
  // Pokud nemáme dostatek dat A učitel neposkytl žádný vstup
  if (resultsCount === 0 && !teacherInput) {
    return `⚠️ Pro ${firstName} nemám dostatek informací k vytvoření hodnocení. Prosím, doplňte hodnocení ručně.`;
  }
  
  if (resultsCount < 2 && !teacherInput) {
    return `⚠️ Pro ${firstName} mám pouze ${resultsCount} ${resultsCount === 1 ? 'výsledek' : 'výsledky'} (průměr ${averageScore}%). Pro kvalitní formativní hodnocení potřebuji více informací.`;
  }
  
  // ============================================
  // PLNÉ FORMATIVNÍ HODNOCENÍ (i s málo daty, pokud máme teacherInput)
  // ============================================
  
  let evaluation = '';
  
  // --- OSLOVENÍ ---
  evaluation += `**SOUHRNNÉ HODNOCENÍ ZA OBDOBÍ**\n\n`;
  evaluation += `${g.mily} ${firstNameVocative},\n\n`;
  
  // Personalizovaný úvod - 2. osoba
  if (averageScore >= 90) {
    evaluation += `V tomto hodnoceném období jsi ${g.podal} vynikající výkon a patříš mezi nejlepší v naší třídě! `;
  } else if (averageScore >= 75) {
    evaluation += `V tomto hodnoceném období jsi ${g.pracoval} velmi svědomitě a ${g.dosahl} nadprůměrných výsledků. `;
  } else if (averageScore >= 60) {
    evaluation += `V tomto hodnoceném období jsi ${g.pracoval} průběžně a ${g.dosahl} solidních výsledků. `;
  } else if (averageScore >= 45) {
    evaluation += `V tomto hodnoceném období jsi ${g.celil} některým výzvám, ale ${g.projevil} jsi snahu o zlepšení. `;
  } else {
    evaluation += `V tomto hodnoceném období jsi ${g.potreboval} intenzivnější podporu při zvládání učiva. `;
  }
  
  // --- PŘEHLED VÝSLEDKŮ ---
  evaluation += `\n\n**Tvé výsledky:**\n`;
  evaluation += `• Celkový průměr: ${averageScore}%\n`;
  evaluation += `• Počet hodnocených aktivit: ${resultsCount}\n`;
  
  // Trend
  if (studentData?.trend) {
    if (studentData.trend === 'improving') {
      evaluation += `• Trend: 📈 Tvé výsledky se v průběhu období zlepšovaly – skvělá práce!\n`;
    } else if (studentData.trend === 'declining') {
      evaluation += `• Trend: 📉 Výsledky mírně klesají – zkus věnovat více pozornosti přípravě\n`;
    } else {
      evaluation += `• Trend: ➡️ Stabilní výkon po celé období\n`;
    }
  }
  
  // Nejlepší a nejhorší výsledek
  if (studentData?.bestResult) {
    evaluation += `• Nejlepší výsledek: ${studentData.bestResult.title} (${studentData.bestResult.percentage}%) 🎉\n`;
  }
  if (studentData?.worstResult && studentData.worstResult.percentage < averageScore - 10) {
    evaluation += `• Oblast k procvičení: ${studentData.worstResult.title} (${studentData.worstResult.percentage}%)\n`;
  }
  
  // --- SILNÉ STRÁNKY ---
  evaluation += `\n**Co ti jde dobře:**\n`;
  
  if (averageScore >= 85) {
    evaluation += `• Výborně rozumíš probírané látce\n`;
    evaluation += `• Dokážeš samostatně řešit i náročnější úlohy\n`;
    evaluation += `• Umíš propojovat poznatky a přemýšlet analyticky\n`;
  } else if (averageScore >= 70) {
    evaluation += `• Zvládáš většinu probíraného učiva\n`;
    evaluation += `• Projevuješ zájem o předmět\n`;
    evaluation += `• Umíš pracovat samostatně na běžných úlohách\n`;
  } else if (averageScore >= 50) {
    evaluation += `• Zvládáš základy probíraného učiva\n`;
    evaluation += `• Snažíš se plnit zadané úkoly\n`;
    evaluation += `• Postupně si buduješ znalostní základy\n`;
  } else {
    evaluation += `• Projevuješ snahu o pochopení látky\n`;
    evaluation += `• S pomocí dokážeš řešit základní úlohy\n`;
  }
  
  // Přidání silných stránek z dat
  if (studentData?.strongAreas && studentData.strongAreas.length > 0) {
    studentData.strongAreas.forEach(area => {
      evaluation += `• ${area}\n`;
    });
  }
  
  // --- OBLASTI KE ZLEPŠENÍ ---
  evaluation += `\n**Na čem můžeš zapracovat:**\n`;
  
  if (averageScore >= 85) {
    evaluation += `• Zkus pomáhat spolužákům – vysvětlování látky prohloubí tvé vlastní porozumění\n`;
    evaluation += `• Neboj se pouštět do náročnějších a rozšiřujících úloh\n`;
  } else if (averageScore >= 70) {
    evaluation += `• Věnuj více pozornosti detailům a přesnosti\n`;
    evaluation += `• Procvičuj témata, kde zatím nedosahuješ maximálních výsledků\n`;
  } else if (averageScore >= 50) {
    evaluation += `• Zkus zlepšit pravidelnost přípravy na výuku\n`;
    evaluation += `• Soustřeď se více na pochopení principů, nejen na zapamatování\n`;
    evaluation += `• Častější procvičování ti pomůže\n`;
  } else {
    evaluation += `• Potřebuješ intenzivnější podporu při pochopení základních konceptů\n`;
    evaluation += `• Neboj se požádat o pomoc – jsem tu pro tebe\n`;
    evaluation += `• Pravidelné konzultace ti mohou hodně pomoct\n`;
  }
  
  // Přidání slabých stránek z dat
  if (studentData?.weakAreas && studentData.weakAreas.length > 0) {
    studentData.weakAreas.forEach(area => {
      evaluation += `• ${area}\n`;
    });
  }
  
  // --- DOPORUČENÍ PRO DALŠÍ OBDOBÍ ---
  evaluation += `\n**Doporučení pro další období:**\n`;
  
  if (averageScore >= 85) {
    evaluation += `1. Pokračuj v dosavadní kvalitní práci\n`;
    evaluation += `2. Zkus se zapojit do soutěží nebo projektů\n`;
    evaluation += `3. Rozvíjej schopnost vysvětlovat látku ostatním\n`;
  } else if (averageScore >= 70) {
    evaluation += `1. Udrž svůj pravidelný studijní režim\n`;
    evaluation += `2. Zaměř se na témata s nižším skóre\n`;
    evaluation += `3. Využívej dostupné studijní materiály k procvičování\n`;
  } else if (averageScore >= 50) {
    evaluation += `1. Zaveď si pravidelnou přípravu na výuku (ideálně denně 15-20 minut)\n`;
    evaluation += `2. Neboj se ptát, když něčemu nerozumíš\n`;
    evaluation += `3. Využij možnosti doučování nebo konzultací\n`;
  } else {
    evaluation += `1. Pojďme spolu navázat užší spolupráci – pravidelné konzultace\n`;
    evaluation += `2. Zaměř se na základy a postupně buduj znalosti\n`;
    evaluation += `3. Využij všech dostupných forem podpory\n`;
  }
  
  // --- UČITELŮV VSTUP ---
  if (teacherInput) {
    evaluation += `\n**Osobní poznámka:**\n`;
    evaluation += teacherInput.trim();
    if (!teacherInput.trim().endsWith('.') && !teacherInput.trim().endsWith('!')) {
      evaluation += '.';
    }
  }
  
  // --- ŠVP HODNOCENÍ ---
  if (svpText && svpText.trim()) {
    evaluation += `\n\n**Plnění vzdělávacích cílů (ŠVP):**\n`;
    if (averageScore >= 85) {
      evaluation += `Výborně plníš očekávané výstupy stanovené školním vzdělávacím programem. `;
      evaluation += `Tvé výsledky ukazují, že jsi ${female ? 'schopná' : 'schopen'} samostatně aplikovat naučené poznatky a dovednosti.\n`;
    } else if (averageScore >= 70) {
      evaluation += `Většinu očekávaných výstupů ŠVP plníš na dobré úrovni. `;
      evaluation += `V některých oblastech je prostor pro další rozvoj.\n`;
    } else if (averageScore >= 50) {
      evaluation += `Základní očekávané výstupy ŠVP plníš, nicméně některé oblasti vyžadují další procvičování. `;
      evaluation += `Doporučuji zaměřit se na klíčové kompetence.\n`;
    } else {
      evaluation += `Plnění očekávaných výstupů ŠVP vyžaduje intenzivnější podporu. `;
      evaluation += `Společně budeme pracovat na dosažení stanovených cílů.\n`;
    }
  }
  
  // --- ZÁVĚR ---
  evaluation += `\n\n**Závěrem:**\n`;
  if (averageScore >= 75) {
    evaluation += `${g.odvedl} jsi v tomto období výbornou práci. Věřím, že v dalším období navážeš na tyto úspěchy a budeš se dále rozvíjet. Jen tak dál! 🌟`;
  } else if (averageScore >= 50) {
    evaluation += `Máš potenciál dosáhnout lepších výsledků. S pravidelnou přípravou a aktivním přístupem věřím, že se v dalším období posuneš vpřed. Držím ti palce! 💪`;
  } else {
    evaluation += `V dalším období potřebuješ zintenzivnit přípravu. S mojí podporou a tvým úsilím je zlepšení určitě možné. Nevzdávej to, věřím v tebe! 🌱`;
  }
  
  return evaluation;
}

