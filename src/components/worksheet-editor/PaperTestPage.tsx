/**
 * Paper Test with AI Grading Page
 * 
 * Flow:
 * 1. Teacher prints the worksheet
 * 2. Students fill it out on paper
 * 3. Teacher uploads photos of completed tests
 * 4. AI analyzes photos and extracts answers
 * 5. Results are saved to class statistics
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Upload,
  Loader2,
  Check,
  X,
  Trash2,
  AlertCircle,
  Sparkles,
  Users,
  FileText,
  Printer,
  ChevronRight,
  Image as ImageIcon,
  Edit3,
  Save,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { getWorksheet } from '../../utils/worksheet-storage';
import { Worksheet } from '../../types/worksheet';
import { getStudents, Student, getClasses, ClassGroup, getClassSubjects } from '../../utils/supabase/classes';
import { supabase } from '../../utils/supabase/client';

interface StudentTest {
  studentId: string;
  studentName: string;
  imageUrl: string | null;
  imageFile: File | null;
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error';
  score: number | null;
  maxScore: number | null;
  answers: string[];
  aiComment: string | null;
  errorMessage: string | null;
}

interface PaperTestPageProps {
  theme?: 'light' | 'dark';
}

interface QuestionData {
  number: number;
  type: 'abc' | 'open' | 'truefalse';
  question: string;
  options?: { label: string; text: string }[];
  correctAnswer?: string;
  maxPoints: number;
}

// Extract questions from worksheet blocks or content
function extractQuestionsFromWorksheet(worksheet: Worksheet | null): QuestionData[] {
  // Try blocks first (newer format), then content (older format)
  const blocks = worksheet?.blocks || (worksheet as any)?.content || [];
  if (!blocks || blocks.length === 0) {
    console.log('[PaperTest] No blocks/content found in worksheet:', worksheet);
    return [];
  }
  
  console.log('[PaperTest] Extracting questions from blocks:', blocks.length, 'blocks');
  
  const questions: QuestionData[] = [];
  let questionNumber = 1;
  
  blocks.forEach((block: any) => {
    // Block content can be in block.content object or directly in block
    const content = block.content || block;
    console.log('[PaperTest] Processing block:', block.type, 'content:', content);
    
    // Multiple choice questions
    if (block.type === 'multiple-choice') {
      // Options are in content.options
      const rawOptions = content.options || block.options || [];
      const options = rawOptions.map((opt: any, idx: number) => ({
        label: String.fromCharCode(65 + idx), // A, B, C, D...
        text: typeof opt === 'string' ? opt : (opt.text || opt.content || ''),
      }));
      
      // Find correct answer - check multiple possible properties
      let correctAnswer = content.correctAnswer || block.correctAnswer;
      
      // Check correctAnswers array (contains IDs of correct options)
      if (!correctAnswer && content.correctAnswers?.length > 0) {
        const correctId = content.correctAnswers[0];
        const correctIdx = rawOptions.findIndex((o: any) => o.id === correctId);
        if (correctIdx >= 0) correctAnswer = String.fromCharCode(65 + correctIdx);
      }
      
      if (!correctAnswer && content.correctIndex !== undefined) {
        correctAnswer = String.fromCharCode(65 + content.correctIndex);
      }
      
      // Get question text from content.question
      const questionText = content.question || block.question || block.text || `Otázka ${questionNumber}`;
      
      questions.push({
        number: questionNumber++,
        type: 'abc',
        question: questionText,
        options,
        correctAnswer,
        maxPoints: block.points || content.points || 1,
      });
    }
    
    // True/False questions
    if (block.type === 'true-false') {
      const questionText = content.question || block.question || block.text || `Otázka ${questionNumber}`;
      questions.push({
        number: questionNumber++,
        type: 'truefalse',
        question: questionText,
        correctAnswer: content.correctAnswer || block.correctAnswer || (content.isTrue ? 'true' : 'false'),
        maxPoints: block.points || content.points || 1,
      });
    }
    
    // Free answer / open questions
    if (block.type === 'free-answer' || block.type === 'open') {
      const questionText = content.question || block.question || block.text || content.placeholder || `Otázka ${questionNumber}`;
      questions.push({
        number: questionNumber++,
        type: 'open',
        question: questionText,
        maxPoints: block.points || content.points || 2,
      });
    }
  });
  
  console.log('[PaperTest] Extracted questions:', questions);
  return questions;
}

export function PaperTestPage({ theme = 'light' }: PaperTestPageProps) {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const classIdFromUrl = searchParams.get('classId');
  
  // State
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentTests, setStudentTests] = useState<StudentTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<'print' | 'upload' | 'review' | 'done'>('print');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Create assignment in the class
  const createAssignment = async () => {
    console.log('[PaperTest] createAssignment called', { selectedClass, worksheet, assignmentId });
    
    if (assignmentId) {
      console.log('[PaperTest] Assignment already exists:', assignmentId);
      return assignmentId;
    }
    
    if (!selectedClass) {
      console.error('[PaperTest] No class selected');
      toast.error('Nebyla vybrána třída');
      return null;
    }
    
    setIsCreatingAssignment(true);
    try {
      const title = worksheet?.name || 'Papírový test';
      console.log('[PaperTest] Creating assignment:', { title, classId: selectedClass.id });
      
      // Use selected subject or first available subject
      const subjectName = selectedSubject || subjects[0] || 'Test';
      
      // Extract questions from worksheet blocks
      const questions = extractQuestionsFromWorksheet(worksheet);
      console.log('[PaperTest] Extracted questions:', questions);
      
      // Also store in localStorage as fallback
      localStorage.setItem(`paper-test-content-${worksheetId}`, JSON.stringify({
        questions,
        totalQuestions: questions.length,
      }));
      
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert({
          title,
          type: 'paper_test',
          class_id: selectedClass.id,
          subject: subjectName,
          worksheet_id: worksheetId, // Reference to original worksheet
          questions, // Store questions structure in Supabase
          due_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) {
        console.error('[PaperTest] Supabase error:', error);
        throw error;
      }
      
      console.log('[PaperTest] Assignment created:', assignment);
      setAssignmentId(assignment.id);
      toast.success(`Sloupec "${title}" vytvořen ve třídě ${selectedClass.name}`);
      return assignment.id;
    } catch (error) {
      console.error('[PaperTest] Error creating assignment:', error);
      toast.error('Nepodařilo se vytvořit sloupec ve třídě');
      return null;
    } finally {
      setIsCreatingAssignment(false);
    }
  };
  
  // Load worksheet and class data
  useEffect(() => {
    const loadData = async () => {
      console.log('[PaperTest] Loading data, worksheetId:', worksheetId, 'classIdFromUrl:', classIdFromUrl);
      setIsLoading(true);
      
      try {
        // Load worksheet
        if (worksheetId) {
          console.log('[PaperTest] Getting worksheet...');
          const ws = getWorksheet(worksheetId);
          console.log('[PaperTest] Worksheet result:', ws ? 'found' : 'not found');
          if (ws) {
            setWorksheet(ws);
          } else {
            console.error('[PaperTest] Worksheet not found in localStorage');
            toast.error('Pracovní list nebyl nalezen');
            navigate('/library/my-content');
            return;
          }
        } else {
          console.error('[PaperTest] No worksheetId provided');
        }
        
        // Load classes
        const loadedClasses = await getClasses();
        setClasses(loadedClasses);
        
        // If classId is provided, select that class
        if (classIdFromUrl) {
          const cls = loadedClasses.find(c => c.id === classIdFromUrl);
          if (cls) {
            setSelectedClass(cls);
            // Load students for this class
            const loadedStudents = await getStudents(cls.id);
            setStudents(loadedStudents);
            // Load subjects for this class
            const loadedSubjects = await getClassSubjects(cls.id);
            const subjectNames = loadedSubjects.map(s => s.subject_name);
            setSubjects(subjectNames);
            // Pre-select first subject
            if (subjectNames.length > 0) {
              setSelectedSubject(subjectNames[0]);
            }
            // Initialize student tests
            setStudentTests(loadedStudents.map(s => ({
              studentId: s.id,
              studentName: s.name,
              imageUrl: null,
              imageFile: null,
              status: 'pending',
              score: null,
              maxScore: null,
              answers: [],
              aiComment: null,
              errorMessage: null,
            })));
          }
        }
      } catch (error) {
        console.error('[PaperTest] Error loading data:', error);
        toast.error('Chyba při načítání dat');
      } finally {
        console.log('[PaperTest] Setting isLoading to false');
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [worksheetId, classIdFromUrl, navigate]);
  
  // Handle class selection
  const handleSelectClass = async (cls: ClassGroup) => {
    setSelectedClass(cls);
    const loadedStudents = await getStudents(cls.id);
    setStudents(loadedStudents);
    setStudentTests(loadedStudents.map(s => ({
      studentId: s.id,
      studentName: s.name,
      imageUrl: null,
      imageFile: null,
      status: 'pending',
      score: null,
      maxScore: null,
      answers: [],
      aiComment: null,
      errorMessage: null,
    })));
  };
  
  // Handle file upload for a student
  const handleFileUpload = (studentId: string, file: File) => {
    const imageUrl = URL.createObjectURL(file);
    setStudentTests(prev => prev.map(st => 
      st.studentId === studentId 
        ? { ...st, imageUrl, imageFile: file, status: 'pending' as const }
        : st
    ));
  };
  
  // Handle bulk upload
  const handleBulkUpload = (files: FileList) => {
    // Match files to students by filename or order
    const fileArray = Array.from(files);
    
    setStudentTests(prev => {
      const updated = [...prev];
      fileArray.forEach((file, index) => {
        if (index < updated.length) {
          updated[index] = {
            ...updated[index],
            imageUrl: URL.createObjectURL(file),
            imageFile: file,
            status: 'pending' as const,
          };
        }
      });
      return updated;
    });
    
    toast.success(`Nahráno ${fileArray.length} fotografií`);
  };
  
  // Remove image from student
  const handleRemoveImage = (studentId: string) => {
    setStudentTests(prev => prev.map(st => 
      st.studentId === studentId 
        ? { ...st, imageUrl: null, imageFile: null, status: 'pending' as const, score: null, answers: [], aiComment: null }
        : st
    ));
  };
  
  // Analyze all uploaded images with AI
  const handleAnalyzeAll = async () => {
    const testsWithImages = studentTests.filter(st => st.imageFile);
    
    if (testsWithImages.length === 0) {
      toast.error('Nejsou nahrány žádné fotografie');
      return;
    }
    
    setIsAnalyzing(true);
    
    for (const test of testsWithImages) {
      // Update status to analyzing
      setStudentTests(prev => prev.map(st => 
        st.studentId === test.studentId 
          ? { ...st, status: 'analyzing' as const }
          : st
      ));
      
      try {
        // Convert image to base64
        const base64 = await fileToBase64(test.imageFile!);
        
        // Call AI to analyze the image
        const result = await analyzeTestImage(base64, worksheet);
        
        // Update with results
        setStudentTests(prev => prev.map(st => 
          st.studentId === test.studentId 
            ? { 
                ...st, 
                status: 'done' as const,
                score: result.score,
                maxScore: result.maxScore,
                answers: result.answers,
                aiComment: result.comment,
              }
            : st
        ));
      } catch (error: any) {
        console.error('Error analyzing test:', error);
        setStudentTests(prev => prev.map(st => 
          st.studentId === test.studentId 
            ? { 
                ...st, 
                status: 'error' as const,
                errorMessage: error.message || 'Chyba při analýze',
              }
            : st
        ));
      }
    }
    
    setIsAnalyzing(false);
    setStep('review');
    toast.success('Analýza dokončena!');
  };
  
  // Save results to Supabase
  const handleSaveResults = async () => {
    if (!selectedClass || !worksheet) return;
    
    try {
      // Use existing assignment or create new one
      let currentAssignmentId = assignmentId;
      
      if (!currentAssignmentId) {
        // Create assignment if it doesn't exist yet
        const { data: assignment, error: assignmentError } = await supabase
          .from('assignments')
          .insert({
            title: worksheet.name || 'Pracovní list',
            type: 'paper_test', // paper test type for proper detection
            class_id: selectedClass.id,
            subject: 'Pracovní list', // Required field
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (assignmentError) throw assignmentError;
        currentAssignmentId = assignment.id;
        setAssignmentId(assignment.id);
      }
      
      // Save results for each student
      const resultsToSave = studentTests
        .filter(st => st.status === 'done' && st.score !== null)
        .map(st => ({
          student_id: st.studentId,
          assignment_id: currentAssignmentId,
          score: st.score,
          max_score: st.maxScore,
          percentage: st.maxScore ? Math.round((st.score! / st.maxScore) * 100) : 0,
          teacher_comment: st.aiComment,
          completed_at: new Date().toISOString(),
        }));
      
      if (resultsToSave.length > 0) {
        const { error: resultsError } = await supabase
          .from('results')
          .upsert(resultsToSave, { onConflict: 'student_id,assignment_id' });
        
        if (resultsError) throw resultsError;
      }
      
      setStep('done');
      toast.success('Výsledky byly uloženy do statistik třídy!');
    } catch (error) {
      console.error('Error saving results:', error);
      toast.error('Chyba při ukládání výsledků');
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                Papírový test s AI hodnocením
              </h1>
              <p className="text-sm text-slate-500">
                {worksheet?.name || 'Pracovní list'}
                {selectedClass && ` • ${selectedClass.name}`}
              </p>
            </div>
          </div>
          
          {/* Steps indicator */}
          <div className="flex items-center gap-2">
            {['print', 'upload', 'review', 'done'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s 
                    ? 'bg-purple-600 text-white' 
                    : ['print', 'upload', 'review', 'done'].indexOf(step) > i
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {['print', 'upload', 'review', 'done'].indexOf(step) > i ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div className={`w-8 h-0.5 ${
                    ['print', 'upload', 'review', 'done'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-slate-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Step 1: Assign Test */}
        {step === 'print' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-6">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                  Krok 1: Zadejte test do třídy
                </h2>
                <p className="text-slate-500">
                  Vytvořte nový sloupec ve třídě {selectedClass?.name || ''} pro tento papírový test.
                </p>
              </div>
              
              {/* Subject selection dropdown */}
              {subjects.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Předmět:
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Questions preview */}
              {worksheet && (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-600 mb-3">
                    Otázky v testu ({extractQuestionsFromWorksheet(worksheet).length}):
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {extractQuestionsFromWorksheet(worksheet).map((q, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                          {q.number}
                        </span>
                        <div className="flex-1">
                          <span className="text-slate-700">{q.question.slice(0, 80)}{q.question.length > 80 ? '...' : ''}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            ({q.type === 'abc' ? 'Výběr' : q.type === 'open' ? 'Otevřená' : 'Ano/Ne'} • {q.maxPoints}b)
                          </span>
                        </div>
                      </div>
                    ))}
                    {extractQuestionsFromWorksheet(worksheet).length === 0 && (
                      <p className="text-slate-400 text-sm">Žádné otázky k hodnocení</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Main CTA: Assign */}
              {!assignmentId ? (
                <button
                  onClick={async () => {
                    const newAssignmentId = await createAssignment();
                    if (newAssignmentId) {
                      toast.success('Test byl zadán do třídy!');
                    }
                  }}
                  disabled={isCreatingAssignment}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 mb-4"
                >
                  {isCreatingAssignment ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  {isCreatingAssignment ? 'Vytvářím...' : 'Zadat test do třídy'}
                </button>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">Test byl zadán do třídy!</p>
                      <p className="text-sm text-green-600">Sloupec "{worksheet?.name || 'Papírový test'}" vytvořen v {selectedClass?.name}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Secondary actions: Print and Continue */}
              <div className="flex flex-col gap-3">
                {/* Main CTA when assignment exists - Continue */}
                {assignmentId && (
                  <button
                    onClick={() => setStep('upload')}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
                  >
                    Pokračovat k nahrání fotek
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
                
                {/* Print button */}
                <button
                  onClick={() => window.open(`/library/my-content/worksheet-editor/${worksheetId}`, '_blank')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-100 text-orange-700 rounded-xl font-medium hover:bg-orange-200 transition-colors"
                >
                  <Printer className="w-5 h-5" />
                  Vytisknout test
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 2: Upload */}
        {step === 'upload' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  Krok 2: Nahrajte fotky testů
                </h2>
                <p className="text-slate-500">
                  Nafoťte nebo naskenujte vyplněné testy a nahrajte je ke každému žákovi.
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Bulk upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Nahrát hromadně
                </button>
                
                <button
                  onClick={handleAnalyzeAll}
                  disabled={isAnalyzing || studentTests.filter(st => st.imageFile).length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isAnalyzing ? 'Analyzuji...' : 'Analyzovat pomocí AI'}
                </button>
              </div>
            </div>
            
            {/* Students grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentTests.map((test) => (
                <StudentTestCard
                  key={test.studentId}
                  test={test}
                  onUpload={(file) => handleFileUpload(test.studentId, file)}
                  onRemove={() => handleRemoveImage(test.studentId)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Step 3: Review */}
        {step === 'review' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  Krok 3: Zkontrolujte výsledky
                </h2>
                <p className="text-slate-500">
                  Zkontrolujte a případně upravte výsledky před uložením.
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Zpět
                </button>
                <button
                  onClick={handleSaveResults}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Uložit výsledky
                </button>
              </div>
            </div>
            
            {/* Results table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Žák</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Stav</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Skóre</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Komentář AI</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {studentTests.map((test) => (
                    <tr key={test.studentId} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{test.studentName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={test.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {test.score !== null && test.maxScore !== null ? (
                          <span className={`font-bold ${
                            (test.score / test.maxScore) >= 0.7 ? 'text-green-600' :
                            (test.score / test.maxScore) >= 0.4 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {test.score}/{test.maxScore}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600 line-clamp-2">
                          {test.aiComment || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                          <Edit3 className="w-4 h-4 text-slate-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                Hotovo!
              </h2>
              <p className="text-slate-500 mb-6">
                Výsledky byly uloženy do statistik třídy {selectedClass?.name}.
              </p>
              
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => navigate(`/library/my-classes/${selectedClass?.id}/results`)}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  Zobrazit výsledky třídy
                </button>
                <button
                  onClick={() => navigate('/library/my-content')}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                >
                  Zpět na obsah
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Student test card component
function StudentTestCard({ 
  test, 
  onUpload, 
  onRemove 
}: { 
  test: StudentTest; 
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Image area */}
      <div 
        className={`aspect-[4/3] relative ${
          test.imageUrl ? '' : 'bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors'
        }`}
        onClick={() => !test.imageUrl && inputRef.current?.click()}
      >
        {test.imageUrl ? (
          <>
            <img 
              src={test.imageUrl} 
              alt={`Test - ${test.studentName}`}
              className="w-full h-full object-cover"
            />
            {/* Status overlay */}
            {test.status === 'analyzing' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <span className="text-sm">Analyzuji...</span>
                </div>
              </div>
            )}
            {test.status === 'done' && (
              <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
            )}
            {test.status === 'error' && (
              <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 text-slate-600 flex items-center justify-center hover:bg-white transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <Camera className="w-10 h-10 mb-2" />
            <span className="text-sm">Klikněte pro nahrání</span>
          </div>
        )}
        
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
      </div>
      
      {/* Student info */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-800">{test.studentName}</span>
          {test.status === 'done' && test.score !== null && test.maxScore !== null && (
            <span className={`text-sm font-bold ${
              (test.score / test.maxScore) >= 0.7 ? 'text-green-600' :
              (test.score / test.maxScore) >= 0.4 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {test.score}/{test.maxScore}
            </span>
          )}
        </div>
        {test.status === 'error' && (
          <p className="text-xs text-red-500 mt-1">{test.errorMessage}</p>
        )}
      </div>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: StudentTest['status'] }) {
  const config = {
    pending: { label: 'Čeká', color: 'bg-slate-100 text-slate-600' },
    uploading: { label: 'Nahrávám', color: 'bg-blue-100 text-blue-600' },
    analyzing: { label: 'Analyzuji', color: 'bg-purple-100 text-purple-600' },
    done: { label: 'Hotovo', color: 'bg-green-100 text-green-600' },
    error: { label: 'Chyba', color: 'bg-red-100 text-red-600' },
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config[status].color}`}>
      {config[status].label}
    </span>
  );
}

// Helper: Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: Analyze test image with AI using Supabase Edge Function
async function analyzeTestImage(
  base64Image: string, 
  worksheet: Worksheet | null
): Promise<{
  score: number;
  maxScore: number;
  answers: string[];
  comment: string;
}> {
  // Get worksheet context for better analysis
  const worksheetContext = worksheet ? `
    Pracovní list: ${worksheet.name || 'Bez názvu'}
    Počet bloků/úkolů: ${worksheet.blocks?.length || 0}
    ${worksheet.blocks?.map((block, i) => {
      if (block.type === 'text') {
        return `Blok ${i + 1} (text): ${block.content?.substring(0, 200) || ''}`;
      }
      if (block.type === 'question') {
        return `Blok ${i + 1} (otázka): ${block.question || ''} - Odpověď: ${block.answer || ''}`;
      }
      return `Blok ${i + 1}: ${block.type}`;
    }).join('\n') || ''}
  ` : '';
  
  // Get expected answers from worksheet blocks
  const expectedAnswers = worksheet?.blocks
    ?.filter(b => b.type === 'question' && b.answer)
    .map(b => b.answer || '') || [];
  
  // Call Supabase Edge Function
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://njbtqmsxbyvpwigfceke.supabase.co';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
  
  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      image: base64Image,
      worksheetContext,
      expectedAnswers,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI analysis error:', errorText);
    throw new Error('Chyba při analýze obrázku');
  }
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result;
}

export default PaperTestPage;

