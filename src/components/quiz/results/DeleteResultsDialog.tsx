import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface StudentInfo {
  id: string;
  name: string;
  score?: number;
  maxScore?: number;
}

interface DeleteResultsDialogProps {
  students: StudentInfo[];
  deleteMode: 'all' | 'student';
  setDeleteMode: (mode: 'all' | 'student') => void;
  studentToDelete: string | null;
  setStudentToDelete: (id: string | null) => void;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteResultsDialog({
  students,
  deleteMode,
  setDeleteMode,
  studentToDelete,
  setStudentToDelete,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteResultsDialogProps) {
  const handleClose = () => {
    setStudentToDelete(null);
    setDeleteMode('all');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '0',
          maxWidth: '450px',
          width: '90%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 style={{ width: '20px', height: '20px', color: '#ef4444' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Smazat výsledky
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Vyberte co chcete smazat</p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Delete All Option */}
          <button
            onClick={() => {
              setDeleteMode('all');
              setStudentToDelete(null);
            }}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              border: deleteMode === 'all' && !studentToDelete ? '2px solid #ef4444' : '1px solid #e2e8f0',
              backgroundColor: deleteMode === 'all' && !studentToDelete ? '#fef2f2' : 'white',
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border:
                  deleteMode === 'all' && !studentToDelete ? '6px solid #ef4444' : '2px solid #cbd5e1',
                backgroundColor: 'white',
              }}
            />
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>
                Smazat všechny výsledky
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Smaže výsledky všech žáků a test ze třídy
              </div>
            </div>
          </button>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              NEBO VYBERTE ŽÁKA
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          </div>

          {/* Student List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => {
                  setDeleteMode('student');
                  setStudentToDelete(student.id);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border:
                    studentToDelete === student.id ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  backgroundColor: studentToDelete === student.id ? '#fef2f2' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border:
                      studentToDelete === student.id ? '5px solid #ef4444' : '2px solid #cbd5e1',
                    backgroundColor: 'white',
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '13px',
                    flexShrink: 0,
                  }}
                >
                  {student.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: '#1e293b',
                      fontSize: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {student.name}
                  </div>
                  {student.score !== undefined && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {student.score}/{student.maxScore ?? '?'} bodů
                    </div>
                  )}
                </div>
              </button>
            ))}

            {students.length === 0 && (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '14px',
                }}
              >
                Žádní žáci k zobrazení
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              color: '#64748b',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Zrušit
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#ef4444',
              color: 'white',
              fontWeight: 500,
              cursor: isDeleting ? 'wait' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isDeleting ? (
              <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Trash2 style={{ width: '16px', height: '16px' }} />
            )}
            {isDeleting ? 'Mažu...' : studentToDelete ? 'Smazat výsledky žáka' : 'Smazat vše'}
          </button>
        </div>
      </div>
    </div>
  );
}
