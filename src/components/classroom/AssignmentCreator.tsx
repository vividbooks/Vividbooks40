/**
 * AssignmentCreator Component
 * 
 * Modal for teachers to create new assignments for students.
 * Allows selecting type (document/presentation/test), writing instructions,
 * setting due date, and toggling AI permission.
 */

import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Presentation, 
  ClipboardCheck, 
  Calendar,
  Bot,
  BotOff,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { 
  StudentAssignmentType, 
  ASSIGNMENT_TYPE_LABELS 
} from '../../types/student-assignment';
import { createAssignment } from '../../utils/student-assignments';
import { toast } from 'sonner';

interface AssignmentCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  teacherId?: string;
  onCreated?: () => void;
}

const ASSIGNMENT_TYPES: {
  type: StudentAssignmentType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}[] = [
  {
    type: 'document',
    label: 'Dokument',
    description: 'Žáci vytvoří textový dokument (esej, referát, sloh...)',
    icon: <FileText className="w-6 h-6" />,
    color: '#3B82F6',
    bgColor: '#DBEAFE',
  },
  {
    type: 'presentation',
    label: 'Prezentace',
    description: 'Žáci vytvoří prezentaci ve Vividboardu',
    icon: <Presentation className="w-6 h-6" />,
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
  },
  {
    type: 'test',
    label: 'Test / Kvíz',
    description: 'Žáci vytvoří vlastní test nebo kvíz',
    icon: <ClipboardCheck className="w-6 h-6" />,
    color: '#10B981',
    bgColor: '#D1FAE5',
  },
];

export function AssignmentCreator({
  isOpen,
  onClose,
  classId,
  className,
  teacherId,
  onCreated,
}: AssignmentCreatorProps) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<StudentAssignmentType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [allowAI, setAllowAI] = useState(true);
  const [subject, setSubject] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectType = (type: StudentAssignmentType) => {
    setSelectedType(type);
    setStep('details');
  };

  const handleBack = () => {
    setStep('type');
  };

  const handleSubmit = async () => {
    if (!selectedType || !title.trim() || !description.trim()) {
      toast.error('Vyplňte prosím název a zadání úkolu');
      return;
    }

    setIsSubmitting(true);

    try {
      await createAssignment(
        classId,
        title.trim(),
        description.trim(),
        selectedType,
        allowAI,
        dueDate || undefined,
        teacherId,
        subject || undefined
      );

      toast.success('Úkol byl zadán', {
        description: `Úkol "${title}" byl zaslán třídě ${className}`,
      });

      // Reset form
      setStep('type');
      setSelectedType(null);
      setTitle('');
      setDescription('');
      setDueDate('');
      setAllowAI(true);
      setSubject('');

      onCreated?.();
      onClose();
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Nepodařilo se zadat úkol');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('type');
    setSelectedType(null);
    setTitle('');
    setDescription('');
    setDueDate('');
    setAllowAI(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              {step === 'type' ? 'Zadat úkol' : 'Detaily úkolu'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Třída: {className}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'type' ? (
            <>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Vyberte typ práce, kterou mají žáci vytvořit:
              </p>

              <div className="space-y-3">
                {ASSIGNMENT_TYPES.map(typeOption => (
                  <button
                    key={typeOption.type}
                    onClick={() => handleSelectType(typeOption.type)}
                    className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 transition-all text-left group"
                  >
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: typeOption.bgColor, color: typeOption.color }}
                      >
                        {typeOption.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {typeOption.label}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {typeOption.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4"
              >
                ← Změnit typ
              </button>

              {/* Selected type indicator */}
              {selectedType && (
                <div className="mb-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center gap-3">
                  {ASSIGNMENT_TYPES.find(t => t.type === selectedType)?.icon}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {ASSIGNMENT_TYPE_LABELS[selectedType]}
                  </span>
                </div>
              )}

              {/* Form */}
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Název úkolu *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Např. Referát o vynálezech 20. století"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Zadání úkolu *
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Popište, co mají žáci vytvořit, jaké jsou požadavky, kritéria hodnocení..."
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Předmět (volitelné)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Např. Dějepis"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Due date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Termín odevzdání (volitelné)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* AI Toggle */}
                <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {allowAI ? (
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <BotOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium text-slate-800 dark:text-white">
                          {allowAI ? 'AI pomocník povolen' : 'AI pomocník zakázán'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {allowAI 
                            ? 'Žáci mohou používat AI asistenta'
                            : 'Žáci nemohou používat AI a budou varováni při podezření'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Toggle switch */}
                    <button
                      onClick={() => setAllowAI(!allowAI)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        allowAI ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div 
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          allowAI ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {!allowAI && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Systém bude detekovat podezřelý text (copy-paste z AI) a zobrazí vám varování u odevzdaných prací.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Zadat úkol třídě
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AssignmentCreator;


