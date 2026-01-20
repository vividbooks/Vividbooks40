/**
 * Test page for StudentDocumentEditor
 * Navigate to /test-student-editor to see it
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentDocumentEditor } from './StudentDocumentEditor';
import { StudentSubmission, createEmptySubmission } from '../../types/student-submission';
import { RichTextEditor } from '../RichTextEditor';

export function TestStudentEditor() {
  const navigate = useNavigate();
  
  // Create a mock submission
  const [submission, setSubmission] = useState<StudentSubmission>(() => 
    createEmptySubmission(
      'test-assignment-1',
      'Testovací úkol - Referát',
      'worksheet',
      'student-1',
      'Test Student',
      'class-1',
      'Třída 6.A',
      {
        hasAssignment: true,
        assignmentDescription: 'Napište referát o libovolném tématu. Minimálně 500 slov. Použijte vlastní slova a citujte zdroje.',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        aiAssistantEnabled: true,
      }
    )
  );

  const [content, setContent] = useState('<p>Začněte psát zde...</p>');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const handleUpdateSubmission = useCallback((updates: Partial<StudentSubmission>) => {
    setSubmission(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSubmit = useCallback(async () => {
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Submitted!', submission);
  }, [submission]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleContentChange = useCallback((html: string) => {
    setContent(html);
    setSaveStatus('unsaved');
    // Auto-save after 1 second
    setTimeout(() => setSaveStatus('saved'), 1000);
  }, []);

  return (
    <StudentDocumentEditor
      submission={submission}
      onUpdateSubmission={handleUpdateSubmission}
      onSubmit={handleSubmit}
      onBack={handleBack}
      saveStatus={saveStatus}
      onUndo={() => console.log('Undo')}
      onRedo={() => console.log('Redo')}
      onShowHistory={() => console.log('Show history')}
    >
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder="Začněte psát svůj referát..."
          />
        </div>
      </div>
    </StudentDocumentEditor>
  );
}

export default TestStudentEditor;


















