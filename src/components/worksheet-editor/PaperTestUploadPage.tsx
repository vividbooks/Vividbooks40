/**
 * Paper Test Upload Page
 * 
 * Dedicated page for uploading photos of paper tests and reviewing AI analysis
 * 
 * Flow:
 * Step 1: Upload photos (bulk or individual per student)
 * Step 2: Review and confirm AI-analyzed results
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  Edit3,
  Save,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import { getStudents, Student, getClassWithData } from '../../utils/supabase/classes';

interface StudentUpload {
  studentId: string;
  studentName: string;
  imageUrl: string | null;
  imageFile: File | null;
  status: 'pending' | 'uploading' | 'analyzing' | 'review' | 'done' | 'error';
  result: AnalysisResult | null;
  errorMessage: string | null;
}

interface AnalysisResult {
  score: number;
  maxScore: number;
  detectedName?: string;
  answers: AnswerResult[];
  comment: string;
}

interface AnswerResult {
  questionNumber: number;
  questionType: 'abc' | 'open';
  answer: string;
  isCorrect?: boolean;
  points: number;
  maxPoints: number;
  feedback?: string;
}

interface QuestionData {
  number: number;
  type: 'abc' | 'open' | 'truefalse';
  question: string;
  options?: { label: string; text: string }[];
  correctAnswer?: string;
  maxPoints: number;
}

interface PaperTestUploadPageProps {
  theme?: 'light' | 'dark';
}

// CSS for spin animation
const spinKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

export function PaperTestUploadPage({ theme = 'light' }: PaperTestUploadPageProps) {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId');
  const navigate = useNavigate();
  
  // State
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isLoading, setIsLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentUploads, setStudentUploads] = useState<StudentUpload[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  
  // Review state
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [editingAnswers, setEditingAnswers] = useState<Record<number, string>>({});
  
  // Bulk upload state
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);
  
  // File input refs
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const individualInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  // Load assignment and students
  useEffect(() => {
    const loadData = async () => {
      if (!assignmentId || !classId) {
        toast.error('Chybí ID testu nebo třídy');
        navigate('/library/my-classes');
        return;
      }
      
      setIsLoading(true);
      
      try {
        // Load assignment
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('assignments')
          .select('*')
          .eq('id', assignmentId)
          .single();
        
        if (assignmentError) throw assignmentError;
        setAssignment(assignmentData);
        
        // Load questions from assignment
        if (assignmentData.questions) {
          setQuestions(assignmentData.questions);
        }
        
        // Load students
        const loadedStudents = await getStudents(classId);
        setStudents(loadedStudents);
        
        // Initialize upload state for each student
        setStudentUploads(loadedStudents.map(s => ({
          studentId: s.id,
          studentName: s.name,
          imageUrl: null,
          imageFile: null,
          status: 'pending',
          result: null,
          errorMessage: null,
        })));
        
      } catch (error: any) {
        console.error('Error loading data:', error);
        toast.error('Nepodařilo se načíst data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [assignmentId, classId, navigate]);
  
  // Handle individual photo upload
  const handleIndividualUpload = async (studentId: string, file: File) => {
    // Update status to uploading
    setStudentUploads(prev => prev.map(su => 
      su.studentId === studentId 
        ? { ...su, status: 'uploading' as const, imageFile: file, imageUrl: URL.createObjectURL(file) }
        : su
    ));
    
    try {
      // Convert to base64
      const base64 = await fileToBase64(file);
      
      // Update status to analyzing
      setStudentUploads(prev => prev.map(su => 
        su.studentId === studentId ? { ...su, status: 'analyzing' as const } : su
      ));
      
      // Call AI analysis
      const student = students.find(s => s.id === studentId);
      const result = await analyzePhoto(base64, student?.name || '');
      
      // Update with result
      setStudentUploads(prev => prev.map(su => 
        su.studentId === studentId 
          ? { ...su, status: 'review' as const, result }
          : su
      ));
      
      toast.success(`Analýza dokončena pro ${student?.name}`);
      
    } catch (error: any) {
      console.error('Error analyzing photo:', error);
      setStudentUploads(prev => prev.map(su => 
        su.studentId === studentId 
          ? { ...su, status: 'error' as const, errorMessage: error.message }
          : su
      ));
      toast.error(`Chyba při analýze: ${error.message}`);
    }
  };
  
  // Handle bulk photo upload
  const handleBulkUpload = async (files: FileList) => {
    const totalFiles = files.length;
    
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      // Update progress
      setBulkUploadProgress({
        current: i + 1,
        total: totalFiles,
        currentName: file.name,
      });
      
      try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        // Get student names for matching
        const studentNames = students.map(s => s.name);
        
        // Call AI analysis with student list for name matching
        const result = await analyzePhoto(base64, '', studentNames);
        
        // Try to match detected name to a student
        let matchedStudentId: string | null = null;
        if (result.detectedName) {
          const matchedStudent = students.find(s => 
            s.name.toLowerCase().includes(result.detectedName!.toLowerCase()) ||
            result.detectedName!.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedStudent) {
            matchedStudentId = matchedStudent.id;
          }
        }
        
        if (matchedStudentId) {
          setStudentUploads(prev => prev.map(su => 
            su.studentId === matchedStudentId 
              ? { 
                  ...su, 
                  status: 'review' as const, 
                  result,
                  imageUrl: URL.createObjectURL(file),
                  imageFile: file,
                }
              : su
          ));
          toast.success(`Přiřazeno k: ${result.detectedName}`);
        } else {
          toast.warning(`Nepodařilo se přiřadit: ${result.detectedName || 'neznámé jméno'}`);
        }
        
      } catch (error: any) {
        console.error('Error in bulk upload:', error);
        toast.error(`Chyba: ${error.message}`);
      }
    }
    
    // Clear progress
    setBulkUploadProgress(null);
  };
  
  // AI analysis function
  const analyzePhoto = async (base64: string, studentName: string, studentList?: string[]): Promise<AnalysisResult> => {
    const { data, error } = await supabase.functions.invoke('analyze-test', {
      body: {
        imageUrl: base64,
        worksheetQuestions: questions,
        studentName,
        worksheetTitle: assignment?.title || 'Test',
        studentList,
      }
    });
    
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    return data;
  };
  
  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  // Get students ready for review
  const studentsToReview = studentUploads.filter(su => su.status === 'review');
  const currentReviewStudent = studentsToReview[currentReviewIndex];
  
  // Save reviewed result
  const saveResult = async (studentUpload: StudentUpload) => {
    if (!studentUpload.result) return;
    
    try {
      const { error } = await supabase.from('results').upsert({
        student_id: studentUpload.studentId,
        assignment_id: assignmentId,
        score: studentUpload.result.score,
        max_score: studentUpload.result.maxScore,
        percentage: Math.round((studentUpload.result.score / studentUpload.result.maxScore) * 100),
        teacher_comment: studentUpload.result.comment,
        answers: studentUpload.result.answers,
      }, { onConflict: 'student_id,assignment_id' });
      
      if (error) throw error;
      
      // Update status to done
      setStudentUploads(prev => prev.map(su => 
        su.studentId === studentUpload.studentId 
          ? { ...su, status: 'done' as const }
          : su
      ));
      
      toast.success(`Výsledky uloženy pro ${studentUpload.studentName}`);
      
      // Move to next review
      if (currentReviewIndex < studentsToReview.length - 1) {
        setCurrentReviewIndex(prev => prev + 1);
      } else {
        // All done
        toast.success('Všechny výsledky byly uloženy!');
      }
      
    } catch (error: any) {
      console.error('Error saving result:', error);
      toast.error(`Chyba při ukládání: ${error.message}`);
    }
  };
  
  // Skip current review
  const skipReview = () => {
    setStudentUploads(prev => prev.map(su => 
      su.studentId === currentReviewStudent?.studentId 
        ? { ...su, status: 'pending' as const, result: null }
        : su
    ));
    
    if (currentReviewIndex < studentsToReview.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
    }
  };
  
  // Update answer in review
  const updateAnswer = (questionNumber: number, newAnswer: string) => {
    if (!currentReviewStudent?.result) return;
    
    setStudentUploads(prev => prev.map(su => {
      if (su.studentId !== currentReviewStudent.studentId || !su.result) return su;
      
      const updatedAnswers = su.result.answers.map(a => 
        a.questionNumber === questionNumber 
          ? { ...a, answer: newAnswer }
          : a
      );
      
      // Recalculate score
      const newScore = updatedAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.maxPoints : 0), 0);
      
      return {
        ...su,
        result: {
          ...su.result,
          answers: updatedAnswers,
          score: newScore,
        }
      };
    }));
  };
  
  // Check if all answers are filled
  const hasUnrecognizedAnswers = currentReviewStudent?.result?.answers.some(a => 
    !a.answer || a.answer === 'Nerozpoznáno' || a.answer === ''
  );
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="text-slate-600">Načítám...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Spin animation style */}
      <style>{spinKeyframes}</style>
      
      {/* Bulk upload progress overlay */}
      {bulkUploadProgress && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '40px 60px',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: '400px',
            }}
          >
            <div 
              style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 24px',
                borderRadius: '50%',
                backgroundColor: '#f3e8ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loader2 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  color: '#9333ea',
                  animation: 'spin 1s linear infinite',
                }} 
              />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              AI analyzuje fotky
            </h3>
            <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '24px' }}>
              Zpracovávám {bulkUploadProgress.current} z {bulkUploadProgress.total}
            </p>
            
            {/* Progress bar */}
            <div 
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e2e8f0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div 
                style={{
                  width: `${(bulkUploadProgress.current / bulkUploadProgress.total) * 100}%`,
                  height: '100%',
                  backgroundColor: '#9333ea',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            
            <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '16px' }}>
              Prosím počkejte, může to trvat několik sekund...
            </p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/library/my-classes?classId=${classId}`)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  {assignment?.title || 'Papírový test'}
                </h1>
                <p className="text-sm text-slate-500">
                  Nahrávání a kontrola výsledků
                </p>
              </div>
            </div>
            
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                step === 'upload' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-slate-100 text-slate-500'
              }`}>
                <Upload className="w-4 h-4" />
                1. Nahrát
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                step === 'review' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-slate-100 text-slate-500'
              }`}>
                <Eye className="w-4 h-4" />
                2. Kontrola
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Bulk upload */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div 
                className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center bg-purple-50/50 hover:bg-purple-50 transition-colors cursor-pointer"
                onClick={() => bulkInputRef.current?.click()}
              >
                <input
                  ref={bulkInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
                />
                <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  Hromadné nahrání fotek
                </h3>
                <p className="text-slate-500 mb-4">
                  Nahrajte fotky všech testů najednou a AI je automaticky přiřadí ke studentům
                </p>
                <button 
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#4E5871',
                    color: 'white',
                    borderRadius: '12px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
                >
                  <Upload className="w-5 h-5" />
                  Nahrát více fotek
                </button>
              </div>
            </div>
            
            {/* Individual uploads */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Nebo nahrajte jednotlivě
              </h3>
              
              <div className="divide-y divide-slate-100">
                {studentUploads.map((su) => (
                  <div key={su.studentId} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                        su.status === 'done' ? 'bg-green-500' :
                        su.status === 'review' ? 'bg-purple-500' :
                        su.status === 'error' ? 'bg-red-500' :
                        'bg-gradient-to-br from-indigo-500 to-purple-500'
                      }`}>
                        {su.status === 'done' ? <Check className="w-5 h-5" /> :
                         su.status === 'review' ? <Eye className="w-5 h-5" /> :
                         su.status === 'error' ? <X className="w-5 h-5" /> :
                         su.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{su.studentName}</div>
                        <div className="text-sm text-slate-500">
                          {su.status === 'pending' && 'Čeká na nahrání'}
                          {su.status === 'uploading' && 'Nahrávám...'}
                          {su.status === 'analyzing' && 'AI analyzuje...'}
                          {su.status === 'review' && `${su.result?.score}/${su.result?.maxScore} bodů - čeká na kontrolu`}
                          {su.status === 'done' && `${su.result?.score}/${su.result?.maxScore} bodů ✓`}
                          {su.status === 'error' && su.errorMessage}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {su.imageUrl && (
                        <img 
                          src={su.imageUrl} 
                          alt="Preview" 
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                        />
                      )}
                      
                      {su.status === 'uploading' || su.status === 'analyzing' ? (
                        <div 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            backgroundColor: '#f3e8ff',
                            borderRadius: '8px',
                            border: '1px solid #d8b4fe',
                          }}
                        >
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#9333ea' }} />
                          <span style={{ fontSize: '14px', color: '#7c3aed', fontWeight: 500 }}>
                            {su.status === 'uploading' ? 'Nahrávám...' : 'AI analyzuje...'}
                          </span>
                        </div>
                      ) : su.status !== 'done' ? (
                        <>
                          <input
                            ref={el => individualInputRefs.current[su.studentId] = el}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleIndividualUpload(su.studentId, file);
                            }}
                          />
                          <button
                            onClick={() => individualInputRefs.current[su.studentId]?.click()}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#4E5871',
                              color: 'white',
                              borderRadius: '8px',
                              fontWeight: 500,
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
                          >
                            <Camera className="w-4 h-4" />
                            Nahrát fotku
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Continue button */}
            {studentsToReview.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={() => { setStep('review'); setCurrentReviewIndex(0); }}
                  style={{
                    padding: '16px 32px',
                    backgroundColor: '#4E5871',
                    color: 'white',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '18px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
                >
                  Pokračovat ke kontrole ({studentsToReview.length})
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Step 2: Review */}
        {step === 'review' && currentReviewStudent && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
            {/* Left Column: Photo(s) */}
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e2e8f0',
                padding: '24px',
                position: 'sticky',
                top: '100px',
                maxHeight: 'calc(100vh - 140px)',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 600, color: '#1e293b', fontSize: '16px' }}>Nahraná fotka</h3>
                <span style={{ fontSize: '14px', color: '#64748b' }}>
                  Student {currentReviewIndex + 1} / {studentsToReview.length}
                </span>
              </div>
              
              {currentReviewStudent.imageUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <img 
                    src={currentReviewStudent.imageUrl} 
                    alt="Test strana 1" 
                    style={{ 
                      width: '100%', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      cursor: 'zoom-in',
                    }}
                    onClick={(e) => {
                      // Open image in new tab for zoom
                      window.open(currentReviewStudent.imageUrl!, '_blank');
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                    Klikněte pro zvětšení
                  </p>
                </div>
              ) : (
                <div style={{ 
                  aspectRatio: '3/4', 
                  backgroundColor: '#f1f5f9', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <ImageIcon style={{ width: '64px', height: '64px', color: '#cbd5e1' }} />
                </div>
              )}
              
              {/* Navigation between students */}
              {studentsToReview.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                  <button
                    onClick={() => setCurrentReviewIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentReviewIndex === 0}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: currentReviewIndex === 0 ? '#f1f5f9' : '#e2e8f0',
                      cursor: currentReviewIndex === 0 ? 'not-allowed' : 'pointer',
                      opacity: currentReviewIndex === 0 ? 0.5 : 1,
                    }}
                  >
                    <ChevronLeft style={{ width: '20px', height: '20px', color: '#475569' }} />
                  </button>
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {studentsToReview.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentReviewIndex(idx)}
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: idx === currentReviewIndex ? '#4E5871' : '#cbd5e1',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                  
                  <button
                    onClick={() => setCurrentReviewIndex(prev => Math.min(studentsToReview.length - 1, prev + 1))}
                    disabled={currentReviewIndex === studentsToReview.length - 1}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: currentReviewIndex === studentsToReview.length - 1 ? '#f1f5f9' : '#e2e8f0',
                      cursor: currentReviewIndex === studentsToReview.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: currentReviewIndex === studentsToReview.length - 1 ? 0.5 : 1,
                    }}
                  >
                    <ChevronRight style={{ width: '20px', height: '20px', color: '#475569' }} />
                  </button>
                </div>
              )}
            </div>
            
            {/* Right Column: Questions & Answers */}
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e2e8f0',
                padding: '24px',
              }}
            >
              {/* Student header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6366f1, #9333ea)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '16px',
                  }}>
                    {currentReviewStudent.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e293b' }}>
                      {currentReviewStudent.studentName}
                    </div>
                    {currentReviewStudent.result?.detectedName && 
                     currentReviewStudent.result.detectedName !== currentReviewStudent.studentName && (
                      <div style={{ fontSize: '14px', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle style={{ width: '16px', height: '16px' }} />
                        AI rozpoznal: {currentReviewStudent.result.detectedName}
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>
                    {currentReviewStudent.result?.score} / {currentReviewStudent.result?.maxScore}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>bodů</div>
                </div>
              </div>
              
              {/* Questions list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {currentReviewStudent.result?.answers.map((answer, idx) => {
                  const question = questions[idx];
                  const isUnrecognized = !answer.answer || answer.answer === 'Nerozpoznáno' || answer.answer === '';
                  
                  return (
                    <div 
                      key={answer.questionNumber}
                      className={`p-4 rounded-xl border ${
                        isUnrecognized 
                          ? 'border-red-300 bg-red-50' 
                          : answer.isCorrect 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-orange-200 bg-orange-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-500">
                            Otázka {answer.questionNumber}
                          </span>
                          {question && (
                            <p className="text-sm text-slate-700 mt-1">
                              {question.question}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnrecognized ? (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          ) : answer.isCorrect ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-orange-600" />
                          )}
                          <span className={`font-medium ${
                            isUnrecognized ? 'text-red-600' :
                            answer.isCorrect ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {answer.points}/{answer.maxPoints}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-slate-500">Odpověď:</span>
                        {answer.questionType === 'abc' ? (
                          <select
                            value={answer.answer}
                            onChange={(e) => updateAnswer(answer.questionNumber, e.target.value)}
                            className={`px-3 py-1 rounded-lg border font-medium ${
                              isUnrecognized 
                                ? 'border-red-300 bg-white text-red-600' 
                                : 'border-slate-300 bg-white text-slate-800'
                            }`}
                          >
                            <option value="">-- Vyberte --</option>
                            {question?.options?.map((opt) => (
                              <option key={opt.label} value={opt.label}>
                                {opt.label}: {opt.text}
                              </option>
                            )) || ['A', 'B', 'C', 'D'].map(letter => (
                              <option key={letter} value={letter}>{letter}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={answer.answer}
                            onChange={(e) => updateAnswer(answer.questionNumber, e.target.value)}
                            className={`flex-1 px-3 py-1 rounded-lg border ${
                              isUnrecognized 
                                ? 'border-red-300 bg-white' 
                                : 'border-slate-300 bg-white'
                            }`}
                            placeholder="Zadejte odpověď..."
                          />
                        )}
                      </div>
                      
                      {question?.correctAnswer && (
                        <div className="text-xs text-slate-500 mt-2">
                          Správná odpověď: {question.correctAnswer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Warning if unrecognized answers */}
              {hasUnrecognizedAnswers && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Některé odpovědi nebyly rozpoznány. Doplňte je prosím před uložením.
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('upload')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    borderRadius: '8px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#cbd5e1'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                >
                  <ChevronLeft className="w-4 h-4" style={{ marginRight: '4px' }} />
                  Zpět
                </button>
                
                <button
                  onClick={skipReview}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f97316',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f97316'}
                >
                  Přeskočit
                </button>
                
                <button
                  onClick={() => saveResult(currentReviewStudent)}
                  disabled={hasUnrecognizedAnswers}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    backgroundColor: hasUnrecognizedAnswers ? '#e2e8f0' : '#22c55e',
                    color: hasUnrecognizedAnswers ? '#94a3b8' : 'white',
                    borderRadius: '12px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: hasUnrecognizedAnswers ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => { if (!hasUnrecognizedAnswers) e.currentTarget.style.backgroundColor = '#16a34a'; }}
                  onMouseLeave={(e) => { if (!hasUnrecognizedAnswers) e.currentTarget.style.backgroundColor = '#22c55e'; }}
                >
                  <Check className="w-5 h-5" />
                  Potvrdit a uložit
                </button>
              </div>
              
            </div>
          </div>
        )}
        
        {/* No more reviews */}
        {step === 'review' && studentsToReview.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Vše hotovo!
            </h2>
            <p className="text-slate-500 mb-6">
              Všechny výsledky byly zkontrolovány a uloženy.
            </p>
            <button
              onClick={() => navigate(`/library/my-classes?classId=${classId}`)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#4E5871',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
            >
              Zpět na třídu
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default PaperTestUploadPage;

