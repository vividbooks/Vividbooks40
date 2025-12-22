import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { DocumentationLayout } from './components/DocumentationLayout';
import { NewAdminLayout } from './components/NewAdminLayout';
import { AdminEditor } from './components/AdminEditor';
import { WelcomePage } from './components/WelcomePage';
import { MyContentLayout } from './components/MyContentLayout';
import { MyContentEditor } from './components/MyContentEditor';
import { MyClassesLayout } from './components/MyClassesLayout';
import { WorksheetEditorLayout } from './components/WorksheetEditorLayout';
import { QuizEditorLayout } from './components/quiz/QuizEditorLayout';
import { QuizViewPage } from './components/quiz/QuizViewPage';
import { QuizJoinPage } from './components/quiz/QuizJoinPage';
import { QuizResultsPage } from './components/quiz/QuizResultsPage';
import { QuizStudentView } from './components/quiz/QuizStudentView';
import { QuizSelfStudyPage } from './components/quiz/QuizSelfStudyPage';
import { ProfilePageLayout, LicenseAdminPage } from './components/profile';
import { StudentWallLayout } from './components/StudentWallLayout';
import { SharedFolderView } from './components/SharedFolderView';
import { PracticeLayout } from './components/PracticeLayout';
import { ViewModeProvider } from './contexts/ViewModeContext';
import { ClassroomShareProvider } from './contexts/ClassroomShareContext';
import { StudentAuthProvider } from './contexts/StudentAuthContext';
import { FirebaseStudentView } from './components/classroom';
import { JoinSession } from './components/classroom/JoinSession';
import { CustomerSuccess } from './components/admin/CustomerSuccess';
import { StudentProfilePage } from './components/classroom/StudentProfilePage';
import ClassChatLayout from './components/classroom/ClassChatLayout';
import { StudentLoginPage, StudentSetupPassword, StudentDashboard, LiveSessionNotification } from './components/student';
import { StudentWorkspace } from './components/student/StudentWorkspace';
import { StudentContentLayout } from './components/student/StudentContentLayout';
import { StudentAssignmentEditor } from './components/student/StudentAssignmentEditor';
import { TeacherLoginPage } from './components/teacher/TeacherLoginPage';
import { supabase } from './utils/supabase/client';
import { projectId, publicAnonKey } from './utils/supabase/info.tsx';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }

    // Check for existing session
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('[App] Auth check timeout, continuing...');
      setIsCheckingAuth(false);
    }, 2000);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.access_token);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      clearTimeout(timeout);
      setIsCheckingAuth(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ViewModeProvider>
    <ClassroomShareProvider>
    <StudentAuthProvider>
    <Router basename={import.meta.env.PROD ? "/Vividbooks40" : ""}>
      {/* Toast notifications */}
      <Toaster position="top-center" richColors />
      
      {/* Firebase-based student view - for students when teacher is sharing */}
      <FirebaseStudentView />
      
      {/* Live session notification for logged-in students */}
      <LiveSessionNotification />
      
      <Routes>
        {/* Student routes */}
        <Route path="/student/login" element={<StudentLoginPage />} />
        <Route path="/student/setup/:token" element={<StudentSetupPassword />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/workspace" element={<StudentContentLayout theme={theme} toggleTheme={toggleTheme} />} />
        <Route path="/student/my-content" element={<StudentContentLayout theme={theme} toggleTheme={toggleTheme} />} />
        <Route path="/student/assignment/:assignmentId" element={<StudentAssignmentEditor theme={theme} toggleTheme={toggleTheme} />} />
        
        {/* Teacher routes */}
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route 
          path="/" 
          element={<WelcomePage theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/join/:sessionId" 
          element={<JoinSession />} 
        />
        
        <Route 
          path="/docs" 
          element={<Navigate to={`/docs/${localStorage.getItem('lastCategory') || 'fyzika'}`} replace />} 
        />
        
        <Route 
          path="/docs/:category" 
          element={<DocumentationLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/docs/:category/*" 
          element={<DocumentationLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-content" 
          element={<MyContentLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-content/view/:id" 
          element={<DocumentationLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-content/edit/:id" 
          element={<MyContentEditor theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-library" 
          element={<MyContentLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-classes" 
          element={<MyClassesLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        <Route 
          path="/library/student/:studentId" 
          element={<StudentProfilePage />} 
        />
        
        <Route 
          path="/library/student-wall" 
          element={<StudentWallLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route path="/class-chat" element={<ClassChatLayout />} />
        <Route path="/class-chat/:classId" element={<ClassChatLayout />} />
        
        <Route 
          path="/library/student-wall/folder/:folderId" 
          element={<SharedFolderView theme={theme} toggleTheme={toggleTheme} />} 
        />

        <Route 
          path="/library/practice" 
          element={<PracticeLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/profile" 
          element={<ProfilePageLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/admin/licence" 
          element={
            isAuthenticated ? (
              <LicenseAdminPage />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/customer-success" 
          element={
            isAuthenticated ? (
              <CustomerSuccess />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/library/my-content/worksheet-editor/:id" 
          element={<WorksheetEditorLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        {/* Quiz Editor */}
        <Route 
          path="/quiz/new" 
          element={<Navigate to={`/quiz/edit/${Date.now()}`} replace />} 
        />
        <Route 
          path="/quiz/edit/:id" 
          element={<QuizEditorLayout theme={theme} />} 
        />
        <Route 
          path="/quiz/view/:id" 
          element={<QuizViewPage />} 
        />
        <Route 
          path="/quiz/join" 
          element={<QuizJoinPage />} 
        />
        <Route 
          path="/quiz/join/:code" 
          element={<QuizJoinPage />} 
        />
        <Route 
          path="/quiz/results/:sessionId" 
          element={<QuizResultsPage />} 
        />
        <Route 
          path="/quiz/student/:shareId" 
          element={<QuizStudentView />} 
        />
        <Route 
          path="/quiz/practice/:id" 
          element={<QuizSelfStudyPage />} 
        />
        
        <Route 
          path="/admin"  
          element={
            isAuthenticated ? (
              <Navigate to="/admin/knihovna-vividbooks" replace />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/admin" replace />
            ) : (
              <LoginPage onLogin={() => setIsAuthenticated(true)} theme={theme} />
            )
          } 
        />
        
        <Route 
          path="/admin/:category" 
          element={
            isAuthenticated ? (
              <NewAdminLayout 
                theme={theme} 
                toggleTheme={toggleTheme}
                onLogout={() => setIsAuthenticated(false)}
              />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/:category/*" 
          element={
            isAuthenticated ? (
              <AdminEditor 
                theme={theme} 
                toggleTheme={toggleTheme}
                onLogout={() => setIsAuthenticated(false)}
              />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
    </StudentAuthProvider>
    </ClassroomShareProvider>
    </ViewModeProvider>
  );
}

function LoginPage({ onLogin, theme }: { onLogin: () => void; theme: 'light' | 'dark' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up via server
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ email, password, name })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Sign up failed');
        }

        // After successful signup, sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        if (signInData.session?.access_token) {
          onLogin();
        }
      } else {
        // Sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        if (data.session?.access_token) {
          onLogin();
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
          <h1 className="mb-6 text-center">{isSignUp ? 'Create Admin Account' : 'Admin Login'}</h1>
          
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block mb-2">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Your name"
                />
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block mb-2">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="admin@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
