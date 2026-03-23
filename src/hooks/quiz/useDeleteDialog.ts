import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';

interface UseDeleteDialogProps {
  sessionId: string | undefined;
  sessionType: string;
}

export interface UseDeleteDialogReturn {
  showDeleteDialog: boolean;
  setShowDeleteDialog: (show: boolean) => void;
  deleteMode: 'all' | 'student';
  setDeleteMode: (mode: 'all' | 'student') => void;
  studentToDelete: string | null;
  setStudentToDelete: (id: string | null) => void;
  isDeleting: boolean;
  handleDeleteResults: () => Promise<void>;
  openDeleteStudentDialog: (studentId: string) => void;
}

export function useDeleteDialog({ sessionId, sessionType }: UseDeleteDialogProps): UseDeleteDialogReturn {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'all' | 'student'>('all');
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteResults = async () => {
    setIsDeleting(true);
    try {
      const classIdParam = searchParams.get('classId');

      if (deleteMode === 'all') {
        if (sessionType === 'paper_test') {
          const { error } = await supabase
            .from('results')
            .delete()
            .eq('assignment_id', sessionId);
          if (error) throw error;

          const { error: assignmentError } = await supabase
            .from('assignments')
            .delete()
            .eq('id', sessionId);
          if (assignmentError) console.error('Error deleting assignment:', assignmentError);

          toast.success('Výsledky a test byly smazány');

          if (classIdParam) {
            navigate(`/library/my-classes?classId=${classIdParam}`);
          } else {
            navigate('/library/my-classes');
          }
        } else {
          toast.info('Pro živé session použijte Firebase konzoli');
        }
      } else if (deleteMode === 'student' && studentToDelete) {
        if (sessionType === 'paper_test') {
          const { error } = await supabase
            .from('results')
            .delete()
            .eq('assignment_id', sessionId)
            .eq('student_id', studentToDelete);
          if (error) throw error;

          localStorage.removeItem(`paper-test-answers-${sessionId}-${studentToDelete}`);
          toast.success('Výsledky žáka byly smazány');
          window.location.reload();
        } else {
          toast.info('Mazání jednotlivých výsledků z živé session není podporováno');
        }
      }
    } catch (error: any) {
      console.error('Error deleting results:', error);
      toast.error(`Chyba při mazání: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setStudentToDelete(null);
    }
  };

  const openDeleteStudentDialog = (studentId: string) => {
    setDeleteMode('student');
    setStudentToDelete(studentId);
    setShowDeleteDialog(true);
  };

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    deleteMode,
    setDeleteMode,
    studentToDelete,
    setStudentToDelete,
    isDeleting,
    handleDeleteResults,
    openDeleteStudentDialog,
  };
}
