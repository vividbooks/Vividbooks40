import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, X, Sparkles, Sparkle, MessageSquare, GraduationCap, BarChart3, ClipboardList, Zap, ArrowRight, User, PlusCircle, Presentation, FileQuestion, FileEdit, Atom, Users, PlayCircle, History, Trash2, ChevronRight } from 'lucide-react';
import { chatWithAIProxy } from '../../utils/ai-chat-proxy';
import { chatWithRAG } from '../../utils/gemini-rag';
import { saveQuiz } from '../../utils/quiz-storage';
import { createEmptyQuiz } from '../../types/quiz';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { HtmlRenderer } from '../HtmlRenderer';
import { publicAnonKey, supabaseUrl } from '../../utils/supabase/info';
import { supabase } from '../../utils/supabase/client';
import { getClasses, getStudents, getAssignments, getResults, getClassSubjects, ClassGroup, Student, Assignment, StudentResult } from '../../utils/supabase/classes';
import { createAssignment } from '../../utils/student-assignments';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{
    type: 'assign' | 'analyze' | 'plan' | 'present' | 'test' | 'worksheet' | 'open_editor' | 'results';
    label: string;
    params?: any;
    executed?: boolean;
    generating?: boolean;
  }>;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface LibraryContext {
  category?: string;
  page?: { id: string; title: string; slug?: string };
  path?: string;
  currentSlug?: string;
  folderTitle?: string;
}

interface TeacherAssistantProps {
  onClose: () => void;
  mode?: 'sidebar' | 'integrated';
  context?: LibraryContext;
}

export function TeacherAssistant({ onClose, mode = 'sidebar', context }: TeacherAssistantProps) {
  const navigate = useNavigate();
  // v2.1 - Hero state with action cards
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableLessons, setAvailableLessons] = useState<string>('');
  const [isLoadingMenu, setIsLoadingMenu] = useState(true); // Track if menu is loading
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Chat history state
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Student results and activity context
  const [resultsContext, setResultsContext] = useState<string>('');
  const [loadingResults, setLoadingResults] = useState(true); // Start loading
  const loadingResultsRef = useRef(true); // Ref for async access
  const resultsContextRef = useRef<string>(''); // Ref for async access to context

  // Suggestion cards for hero state - original content with new design
  const suggestions = [
    { 
      icon: Atom, 
      title: 'Otevři lekci',
      description: 'Najdi "Elektrický proud"',
      query: 'Otevři lekci o elektrickém proudu',
      color: '#8B5CF6',
      bgColor: '#8B5CF620',
      borderColor: '#8B5CF6'
    },
    { 
      icon: FileQuestion, 
      title: 'Vytvoř test',
      description: 'do Vividboardu z atomů',
      query: 'Vytvoř test z atomů pro 8. třídu',
      color: '#EC4899',
      bgColor: '#EC489920',
      borderColor: '#EC4899'
    },
    { 
      icon: Users, 
      title: 'Zadej úkol',
      description: 'třídě 9.C na zítra',
      query: 'Zadej třídě 9.C domácí úkol na téma hustota',
      color: '#10B981',
      bgColor: '#10B98120',
      borderColor: '#10B981'
    },
    { 
      icon: BarChart3, 
      title: 'Ukaž výsledky',
      description: 'posledního testu 8.A',
      query: 'Ukaž mi výsledky posledního testu třídy 8.A',
      color: '#F59E0B',
      bgColor: '#F59E0B20',
      borderColor: '#F59E0B'
    },
  ];

  // Load menu once to give AI context about valid links - with caching and parallel loading
  useEffect(() => {
    const CACHE_KEY = 'vividbooks_ai_menu_context';
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    const loadMenuContext = async () => {
      try {
        console.log('[Assistant] === LOADING MENU CONTEXT ===');
        
        // Try cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const { context, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION && context) {
              console.log('[Assistant] ✓ Using cached menu context (age:', Math.round((Date.now() - timestamp) / 1000), 's)');
              setAvailableLessons(context);
              setIsLoadingMenu(false);
              return;
            }
          } catch (e) {
            console.log('[Assistant] Cache invalid, reloading...');
          }
        }
        
        // Load menu for ALL categories IN PARALLEL (matematika, fyzika, etc.)
        const categories = ['matematika', 'fyzika', 'prvouky', 'prirodopis', 'chemie'];
        
        const fetchCategory = async (category: string) => {
          try {
            const response = await fetch(`https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log(`[Assistant] ✓ Loaded ${category}:`, data.menu?.length || 0, 'items');
              if (data.menu && data.menu.length > 0) {
                return { category, items: data.menu };
              }
            }
          } catch (err) {
            console.error(`[Assistant] Error loading ${category}:`, err);
          }
          return null;
        };
        
        // Parallel fetch all categories
        const results = await Promise.all(categories.map(fetchCategory));
        const allMenus = results.filter(Boolean) as { category: string; items: any[] }[];
        
        console.log('[Assistant] Total categories loaded:', allMenus.length);
        
        // Zjednodušit menu pro AI kontext (jen názvy a slugy - max 2 úrovně pro rychlost)
        const simplify = (items: any[], depth = 0): string => {
          if (depth > 1) return ''; // Omezit hloubku
          return items.map(i => {
            let res = `- ${i.label} (${i.slug || i.id})`;
            if (i.children && depth < 1) {
              const childContext = simplify(i.children, depth + 1);
              if (childContext) res += '\n' + childContext.split('\n').map(l => '  ' + l).join('\n');
            }
            return res;
          }).join('\n');
        };
        
        let context = '';
        for (const menu of allMenus) {
          context += `\n=== ${menu.category.toUpperCase()} ===\n`;
          context += simplify(menu.items);
          context += '\n';
        }
        
        console.log('[Assistant] Final context length:', context.length, 'characters');
        
        // Cache the result
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          context,
          timestamp: Date.now()
        }));
        
        setAvailableLessons(context);
        setIsLoadingMenu(false);
        console.log('[Assistant] ✓ Menu context loaded and cached');
      } catch (err) {
        console.error('[Assistant] ✗ Failed to load menu context:', err);
        setIsLoadingMenu(false);
      }
    };
    loadMenuContext();
  }, []);

  // Load student results and activity data
  useEffect(() => {
    let cancelled = false;
    console.log('[Assistant] Results useEffect started');
    
    const loadResultsContext = async () => {
      // Wait a bit for auth to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('[Assistant] Checking localStorage for session...');
      
      // ONLY use localStorage - no Supabase SDK calls that can hang!
      let userId: string | null = null;
      let accessToken: string | null = null;
      
      try {
        const storedSession = localStorage.getItem('sb-njbtqmsxbyvpwigfceke-auth-token');
        console.log('[Assistant] localStorage session exists:', !!storedSession);
        
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          console.log('[Assistant] Parsed session:', { 
            hasToken: !!parsed?.access_token, 
            hasUser: !!parsed?.user,
            userId: parsed?.user?.id?.substring(0, 8) 
          });
          
          if (parsed?.access_token && parsed?.user?.id) {
            userId = parsed.user.id;
            accessToken = parsed.access_token;
          }
        }
      } catch (e) {
        console.log('[Assistant] localStorage parse failed:', e);
      }
      
      if (cancelled) return;
      
      console.log('[Assistant] Loading class data...');
      
      try {
        // 1. Load teacher's classes - use same cache as MyClassesLayout!
        const CLASSES_CACHE_KEY = 'vividbooks_classes_cache';
        let classes: ClassGroup[] = [];
        
        // First try cache (same as MyClassesLayout)
        try {
          const cachedData = localStorage.getItem(CLASSES_CACHE_KEY);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed && parsed.length > 0) {
              // Map cached data to ClassGroup format
              classes = parsed.map((c: any) => ({
                id: c.id,
                name: c.name,
                teacher_id: c.teacher_id || userId || '',
                students_count: c.studentsCount || c.students_count || 0,
                created_at: c.createdAt || c.created_at || '',
              }));
              console.log('[Assistant] Classes loaded from cache:', classes.length);
            }
          }
        } catch (e) {
          console.warn('[Assistant] Cache read error:', e);
        }
        
        // If no cache, try Supabase directly with retry
        if (classes.length === 0) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            classes = await getClasses(userId || undefined);
            console.log(`[Assistant] Classes from Supabase (attempt ${attempt}):`, classes.length);
            
            if (classes.length > 0) break;
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
          }
        }
        
        if (classes.length === 0) {
          console.log('[Assistant] No classes found');
        }
        
        if (cancelled) return;
        
        // 2. Load students and assignments for each class - PARALLEL loading
        let allStudents: Student[] = [];
        let allAssignments: Assignment[] = [];
        let allResults: { [studentId: string]: { [assignmentId: string]: StudentResult } } = {};
        
        // Load all classes in parallel
        const classDataPromises = classes.map(async (cls) => {
          const [students, assignments, results] = await Promise.all([
            getStudents(cls.id),
            getAssignments(cls.id),
            getResults(cls.id),
          ]);
          return { students, assignments, results };
        });
        
        const classDataResults = await Promise.all(classDataPromises);
        
        for (const data of classDataResults) {
          allStudents = [...allStudents, ...data.students];
          allAssignments = [...allAssignments, ...data.assignments];
          
          // Merge results
          for (const studentId of Object.keys(data.results)) {
            if (!allResults[studentId]) allResults[studentId] = {};
            Object.assign(allResults[studentId], data.results[studentId]);
          }
        }
        
        console.log('[Assistant] Students loaded:', allStudents.length);
        console.log('[Assistant] Assignments loaded:', allAssignments.length);
        console.log('[Assistant] Results loaded:', Object.keys(allResults).length, 'students with results');
        
        // Flatten results for easier processing
        const flatResults: any[] = [];
        for (const studentId of Object.keys(allResults)) {
          for (const assignmentId of Object.keys(allResults[studentId])) {
            flatResults.push(allResults[studentId][assignmentId]);
          }
        }
        
        const students = allStudents;
        const assignments = allAssignments;
        const results = flatResults;
        
        // 5. Load subjects for each class
        const classSubjectsMap: { [classId: string]: string[] } = {};
        for (const cls of classes) {
          try {
            const subjects = await getClassSubjects(cls.id);
            classSubjectsMap[cls.id] = subjects.map(s => s.subject_name);
          } catch (e) {
            classSubjectsMap[cls.id] = ['Fyzika', 'Matematika']; // Default fallback
          }
        }
        
        // 6. Build context string for AI - include links to student profiles
        // Correct URLs: /library/student/{id} for student profile, /library/my-classes?classId={id} for class
        let context = '=== MOJE TŘÍDY A ŽÁCI ===\n';
        context += 'Když zmiňuješ žáka, použij odkaz: [Jméno žáka](/library/student/ID)\n\n';
        
        for (const cls of classes) {
          const classStudents = students.filter((s: any) => s.class_id === cls.id);
          const classSubjects = classSubjectsMap[cls.id] || [];
          context += `\nTřída: [${cls.name}](/library/my-classes?classId=${cls.id}) (ID: ${cls.id})\n`;
          context += `  Předměty: ${classSubjects.length > 0 ? classSubjects.join(', ') : 'žádné nastaveny'}\n`;
          context += `  Počet žáků: ${classStudents.length}\n`;
          context += `  Žáci:\n`;
          for (const s of classStudents) {
            context += `    - [${s.name}](/library/student/${s.id})\n`;
          }
        }
        
        context += '\n=== NEDÁVNÉ TESTY A ÚKOLY ===\n';
        for (const assignment of assignments.slice(0, 10)) {
          const assignmentResults = results.filter((r: any) => r.assignment_id === assignment.id);
          const avgScore = assignmentResults.length > 0
            ? Math.round(assignmentResults.reduce((sum: number, r: any) => sum + (r.percentage || 0), 0) / assignmentResults.length)
            : null;
          
          const classForAssignment = classes.find((c: any) => c.id === assignment.class_id);
          // Link to class results tab (assignmentId not supported in URL, so link to class)
          const resultsUrl = classForAssignment 
            ? `/library/my-classes?classId=${classForAssignment.id}` 
            : `/library/my-classes?tab=results`;
          context += `\n📝 [${assignment.title}](${resultsUrl})`;
          if (classForAssignment) context += ` (${classForAssignment.name})`;
          context += ` - ${new Date(assignment.created_at).toLocaleDateString('cs')}\n`;
          
          if (avgScore !== null) {
            context += `   Průměrná úspěšnost: ${avgScore}%\n`;
            context += `   Počet odevzdání: ${assignmentResults.length}\n`;
            
            // Best and worst performers with links
            const sorted = [...assignmentResults].sort((a: any, b: any) => (b.percentage || 0) - (a.percentage || 0));
            if (sorted.length > 0) {
              const best = sorted[0];
              const bestStudent = students.find((s: any) => s.id === best.student_id);
              if (bestStudent) {
                context += `   Nejlepší: [${bestStudent.name}](/library/student/${bestStudent.id}) (${best.percentage}%)\n`;
              }
              if (sorted.length > 1) {
                const worst = sorted[sorted.length - 1];
                const worstStudent = students.find((s: any) => s.id === worst.student_id);
                if (worstStudent && worst.percentage !== best.percentage) {
                  context += `   Nejslabší: [${worstStudent.name}](/library/student/${worstStudent.id}) (${worst.percentage}%)\n`;
                }
              }
            }
          } else {
            context += `   Zatím žádné výsledky\n`;
          }
        }
        
        // 6. Detailed student results - this is what AI should use
        context += '\n=== DETAILNÍ VÝSLEDKY ŽÁKŮ ===\n';
        context += '(Používej POUZE tato data, nic si nevymýšlej!)\n\n';
        
        for (const student of students) {
          const studentResults = results.filter((r: any) => r.student_id === student.id);
          const studentClass = classes.find((c: any) => c.id === student.class_id);
          
          context += `### [${student.name}](/library/student/${student.id})`;
          if (studentClass) context += ` (${studentClass.name})`;
          context += '\n';
          
          if (studentResults.length > 0) {
            const avgPercentage = Math.round(studentResults.reduce((sum: number, r: any) => sum + (r.percentage || 0), 0) / studentResults.length);
            context += `Průměrná úspěšnost: ${avgPercentage}%\n`;
            context += `Počet testů: ${studentResults.length}\n`;
            context += `Výsledky:\n`;
            
            for (const result of studentResults) {
              const assignment = assignments.find((a: any) => a.id === result.assignment_id);
              if (assignment) {
                context += `  - ${assignment.title}: ${result.percentage || 0}% (${result.score || 0}/${result.max_score || 0})\n`;
              }
            }
          } else {
            context += `Žádné výsledky\n`;
          }
          context += '\n';
        }
        
        // List of all student names for validation
        context += '\n=== SEZNAM VŠECH ŽÁKŮ ===\n';
        const studentNames = students.map((s: any) => s.name);
        console.log('[Assistant] ALL STUDENT NAMES:', studentNames);
        context += studentNames.join(', ');
        context += '\n\nPokud žák NENÍ v tomto seznamu, řekni že ho nemáš v databázi!';
        
        setResultsContext(context);
        resultsContextRef.current = context; // Store in ref for immediate access
        setLoadingResults(false);
        loadingResultsRef.current = false;
        console.log('[Assistant] Results context loaded:', classes.length, 'classes,', assignments.length, 'assignments');
      } catch (err) {
        console.error('[Assistant] Failed to load results context:', err);
        setLoadingResults(false);
        loadingResultsRef.current = false;
      }
    };
    loadResultsContext();
    
    return () => { cancelled = true; };
  }, []);

  // Load chat history from Supabase with localStorage fallback
  const loadChatHistory = useCallback(async () => {
    setLoadingHistory(true);
    console.log('[ChatHistory] === LOAD START ===');
    try {
      // First try localStorage as cache
      const cachedHistory = localStorage.getItem('vividbooks_chat_history');
      console.log('[ChatHistory] localStorage check:', { exists: !!cachedHistory, length: cachedHistory?.length });
      if (cachedHistory) {
        try {
          const parsed = JSON.parse(cachedHistory);
          console.log('[ChatHistory] Found cached sessions:', parsed.length, parsed);
          setChatSessions(parsed.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          })));
        } catch (e) {
          console.error('[ChatHistory] Failed to parse cache:', e);
        }
      }
      
      // Use the robust auth pattern
      const getAuth = async () => {
        console.log('[ChatHistory] Getting auth...');
        // Try direct token first
        const stored = localStorage.getItem('sb-njbtqmsxbyvpwigfceke-auth-token');
        console.log('[ChatHistory] localStorage auth exists:', !!stored);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            console.log('[ChatHistory] Parsed auth:', { hasToken: !!parsed?.access_token, hasUser: !!parsed?.user?.id, userId: parsed?.user?.id?.substring(0, 8) });
            if (parsed?.access_token && parsed?.user?.id) {
              return { userId: parsed.user.id, token: parsed.access_token };
            }
          } catch (e) {
            console.error('[ChatHistory] Failed to parse auth:', e);
          }
        }
        
        // Fallback to getSession
        console.log('[ChatHistory] Falling back to getSession...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[ChatHistory] getSession result:', { hasSession: !!session, hasToken: !!session?.access_token, hasUser: !!session?.user?.id });
        if (session?.access_token && session?.user?.id) {
          return { userId: session.user.id, token: session.access_token };
        }
        return null;
      };

      const auth = await getAuth();
      if (!auth) {
        console.error('[ChatHistory] ❌ No auth session found!');
        setLoadingHistory(false);
        return;
      }
      
      console.log('[ChatHistory] ✓ Auth obtained:', { userId: auth.userId.substring(0, 8), tokenLength: auth.token.length });
      console.log('[ChatHistory] Fetching from Supabase...');
      console.log('[ChatHistory] URL:', `${supabaseUrl}/rest/v1/teacher_chat_history?user_id=eq.${auth.userId}&order=updated_at.desc&limit=50`);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/teacher_chat_history?user_id=eq.${auth.userId}&order=updated_at.desc&limit=50`, {
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${auth.token}`,
        }
      });
      
      console.log('[ChatHistory] Supabase response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[ChatHistory] ✓ Data received:', data.length, 'sessions');
        console.log('[ChatHistory] Full data:', data);
        const sessions: ChatSession[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          messages: row.messages || [],
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }));
        setChatSessions(sessions);
        // Cache to localStorage
        localStorage.setItem('vividbooks_chat_history', JSON.stringify(sessions));
        console.log('[ChatHistory] ✓ Saved to localStorage');
      } else {
        const errorText = await response.text();
        console.error('[ChatHistory] ❌ Supabase fetch failed:', response.status, errorText);
      }
    } catch (err) {
      console.error('[ChatHistory] ❌ Load error:', err);
    } finally {
      setLoadingHistory(false);
      console.log('[ChatHistory] === LOAD END ===');
    }
  }, []);

  // Save current session to Supabase with localStorage fallback
  const saveCurrentSession = useCallback(async (msgs: Message[]) => {
    if (msgs.length === 0) {
      console.log('[ChatHistory] === SAVE SKIPPED (no messages) ===');
      return;
    }
    console.log('[ChatHistory] === SAVE START ===');
    console.log('[ChatHistory] Messages to save:', msgs.length);
    
    // Generate title from first user message
    const firstUserMsg = msgs.find(m => m.role === 'user');
    const title = firstUserMsg?.content.slice(0, 50) || 'Nový chat';
    const sessionId = currentSessionId || `chat_${Date.now()}`;
    
    console.log('[ChatHistory] Session ID:', sessionId);
    console.log('[ChatHistory] Title:', title);
    console.log('[ChatHistory] Current session ID:', currentSessionId);
    
    const chatSession: ChatSession = {
      id: sessionId,
      title,
      messages: msgs,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Always save to localStorage first
    console.log('[ChatHistory] Saving to localStorage...');
    setChatSessions(prev => {
      const existing = prev.findIndex(s => s.id === sessionId);
      let updated: ChatSession[];
      if (existing >= 0) {
        console.log('[ChatHistory] Updating existing session at index', existing);
        updated = [...prev];
        updated[existing] = chatSession;
      } else {
        console.log('[ChatHistory] Creating new session');
        updated = [chatSession, ...prev];
      }
      localStorage.setItem('vividbooks_chat_history', JSON.stringify(updated));
      console.log('[ChatHistory] ✓ Saved to localStorage, total sessions:', updated.length);
      return updated;
    });
    
    if (!currentSessionId) {
      console.log('[ChatHistory] Setting current session ID to:', sessionId);
      setCurrentSessionId(sessionId);
    }
    
    // Try to save to Supabase
    try {
      console.log('[ChatHistory] Getting auth for Supabase...');
      const stored = localStorage.getItem('sb-njbtqmsxbyvpwigfceke-auth-token');
      let userId, token;
      
      if (stored) {
        const parsed = JSON.parse(stored);
        userId = parsed?.user?.id;
        token = parsed?.access_token;
        console.log('[ChatHistory] Got auth from localStorage:', { hasUserId: !!userId, hasToken: !!token, userId: userId?.substring(0, 8) });
      }
      
      if (!userId || !token) {
        console.log('[ChatHistory] Falling back to getSession...');
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
        token = session?.access_token;
        console.log('[ChatHistory] Got auth from getSession:', { hasUserId: !!userId, hasToken: !!token });
      }

      if (!userId || !token) {
        console.error('[ChatHistory] ❌ No auth for saving');
        return;
      }
      
      const payload = {
        id: sessionId,
        user_id: userId,
        title,
        messages: msgs.map(m => ({
          ...m,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
        })),
        updated_at: new Date().toISOString(),
      };
      
      console.log('[ChatHistory] Payload:', { id: payload.id, user_id: payload.user_id, title: payload.title, messagesCount: payload.messages.length });
      console.log('[ChatHistory] Saving to Supabase...');
      console.log('[ChatHistory] URL:', `${supabaseUrl}/rest/v1/teacher_chat_history`);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/teacher_chat_history`, {
        method: 'POST',
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });
      
      console.log('[ChatHistory] Supabase response:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChatHistory] ❌ Supabase save failed:', response.status, errorText);
        console.error('[ChatHistory] Failed payload:', payload);
      } else {
        const responseData = await response.text();
        console.log('[ChatHistory] ✓ Successfully saved to Supabase');
        console.log('[ChatHistory] Response data:', responseData);
      }
    } catch (err) {
      console.error('[ChatHistory] ❌ Save error:', err);
    } finally {
      console.log('[ChatHistory] === SAVE END ===');
    }
  }, [currentSessionId]);

  // Delete a chat session
  const deleteSession = async (sessionId: string) => {
    console.log('[ChatHistory] Deleting session:', sessionId);
    try {
      const stored = localStorage.getItem('sb-njbtqmsxbyvpwigfceke-auth-token');
      let token;
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          token = parsed?.access_token;
        } catch (e) {}
      }
      
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }

      if (!token) {
        console.log('[ChatHistory] No token for deletion');
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/teacher_chat_history?id=eq.${sessionId}`, {
        method: 'DELETE',
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChatHistory] Delete failed:', response.status, errorText);
      } else {
        console.log('[ChatHistory] Successfully deleted from Supabase');
      }
      
      setChatSessions(prev => {
        const updated = prev.filter(s => s.id !== sessionId);
        localStorage.setItem('vividbooks_chat_history', JSON.stringify(updated));
        return updated;
      });
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      toast.success('Chat smazán');
    } catch (err) {
      console.error('[ChatHistory] Delete error:', err);
    }
  };

  // Load a specific session
  const loadSession = (session: ChatSession) => {
    setMessages(session.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })));
    setCurrentSessionId(session.id);
    setShowHistory(false);
  };

  // Start new chat
  const startNewChat = () => {
    // Save current if has messages
    if (messages.length > 0) {
      saveCurrentSession(messages);
    }
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
  };

  // Load history on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Auto-save session when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        saveCurrentSession(messages);
      }, 2000); // Debounce 2s
      return () => clearTimeout(timer);
    }
  }, [messages, saveCurrentSession]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAction = async (type: string, label: string, msgIndex: number, actionIndex: number) => {
    // Pokud učitel chce vytvořit test, vygenerujeme otázky a zeptáme se na potvrzení
    if (type === 'test') {
      // Najít téma z kontextu konverzace
      const recentMessages = messages.slice(-5);
      const topicContext = recentMessages.map(m => m.content).join(' ');
      
      // Nastavit stav generování
      setMessages(prev => prev.map((m, i) => 
        i === msgIndex ? { 
          ...m, 
          actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: true } : a) 
        } : m
      ));

      try {
        const generateQuestionsPrompt = `Na základě kontextu konverzace vygeneruj 5 testových otázek.

Kontext: ${topicContext}

Vygeneruj otázky v tomto formátu:
1. **[Otázka]**
   - a) možnost A
   - b) možnost B  
   - c) možnost C
   - ✓ Správná: [písmeno]

2. ... (další otázky)

Otázky by měly být různé obtížnosti (od jednoduché po těžší).

Na konec NEPIŠ žádné další otázky ani vysvětlení.`;

        const response = await chatWithAIProxy([
          { role: 'system', content: 'Jsi expert na tvorbu testů. Generuješ kvalitní testové otázky pro české školy. Piš stručně, pouze otázky.' },
          { role: 'user', content: generateQuestionsPrompt }
        ], 'gemini-3-flash');

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response + `

---

**Je to tak OK?** Pokud chcete něco upravit, napište mi to. Jinak vyberte formát:`,
          actions: [
            { type: 'open_editor' as const, label: '🎮 Vytvořit Vividboard', executed: false, params: { generateBoard: true, questions: response } },
            { type: 'worksheet' as const, label: '📄 Vytvořit pracovní list', executed: false, params: { questions: response } }
          ],
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } catch (err) {
        console.error('Test generation error:', err);
        toast.error('Nepodařilo se vygenerovat test.');
      } finally {
        setMessages(prev => prev.map((m, i) => 
          i === msgIndex ? { 
            ...m, 
            actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: false, executed: true } : a) 
          } : m
        ));
      }
      return;
    }

    // Otevření editoru s vygenerovanými daty
    if (type === 'open_editor') {
      const action = messages[msgIndex].actions?.[actionIndex];
      
      // Pokud máme generateBoard flag, vytvoříme nový board z otázek
      if (action?.params?.generateBoard && action?.params?.questions) {
        setMessages(prev => prev.map((m, i) => 
          i === msgIndex ? { 
            ...m, 
            actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: true } : a) 
          } : m
        ));

        try {
          // Parse questions and create board with detailed prompt
          const parsePrompt = `Převeď tyto testové otázky do JSON formátu.

VSTUP:
${action.params.questions}

DŮLEŽITÉ:
- "options" musí obsahovat CELÝ TEXT odpovědí (ne jen písmena a), b), c))
- "correctIndex" je index správné odpovědi (0, 1, nebo 2)
- Extrahuj správnou odpověď z textu (hledej ✓ nebo "Správná:")

Vrať POUZE tento JSON (bez markdown, bez vysvětlení):
{
  "title": "Test: [extrahuj téma z otázek]",
  "subject": "Fyzika",
  "grade": 6,
  "questions": [
    {
      "question": "Text první otázky?",
      "options": ["Celý text odpovědi A", "Celý text odpovědi B", "Celý text odpovědi C"],
      "correctIndex": 1
    }
  ]
}`;

          const jsonResponse = await chatWithAIProxy([
            { role: 'system', content: 'Jsi JSON parser. Vrať POUZE validní JSON bez jakéhokoli dalšího textu nebo markdown.' },
            { role: 'user', content: parsePrompt }
          ], 'gemini-3-flash');

          console.log('[TeacherAssistant] JSON response:', jsonResponse);

          // Extract JSON from response - handle potential markdown code blocks
          let jsonString = jsonResponse;
          
          // Remove markdown code blocks if present
          jsonString = jsonString.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
          
          const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const boardData = JSON.parse(jsonMatch[0]);
            console.log('[TeacherAssistant] Parsed board data:', boardData);
            
            const newQuiz = createEmptyQuiz(crypto.randomUUID());
            newQuiz.title = boardData.title || 'Test';
            newQuiz.subject = boardData.subject || 'Fyzika';
            newQuiz.grade = boardData.grade || 6;
            
            // Labels for ABC options
            const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            
            newQuiz.slides = boardData.questions.map((q: any, idx: number) => {
              // Ensure options is an array with content
              const options = Array.isArray(q.options) && q.options.length > 0 
                ? q.options 
                : ['Odpověď A', 'Odpověď B', 'Odpověď C'];
              
              console.log(`[TeacherAssistant] Question ${idx + 1}:`, q.question, 'Options:', options);
              
              return {
                id: crypto.randomUUID(),
                type: 'activity',
                activityType: 'abc',
                order: idx + 1,
                question: q.question || `Otázka ${idx + 1}`,
                options: options.map((opt: string, oi: number) => ({
                  id: `opt-${oi}`,
                  label: labels[oi] || String(oi + 1), // A, B, C...
                  content: String(opt || `Možnost ${oi + 1}`), // CONTENT not text!
                  isCorrect: oi === (q.correctIndex || 0)
                })),
                points: 1
              };
            });
            
            saveQuiz(newQuiz);
            navigate(`/quiz/edit/${newQuiz.id}`);
            toast.success('Test vytvořen! Otevírám editor...');
          }
        } catch (err) {
          console.error('Board creation error:', err);
          toast.error('Nepodařilo se vytvořit board.');
        } finally {
          setMessages(prev => prev.map((m, i) => 
            i === msgIndex ? { 
              ...m, 
              actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: false, executed: true } : a) 
            } : m
          ));
        }
        return;
      }
      
      // Jinak otevři existující quiz
      if (action?.params?.quizId) {
        navigate(`/quiz/edit/${action.params.quizId}`);
        toast.success('Otevírám editor Vividboard...');
      }
      return;
    }

    // Vytvoření pracovního listu
    if (type === 'worksheet') {
      const msg = messages[msgIndex];
      
      // Nastavit stav generování
      setMessages(prev => prev.map((m, i) => 
        i === msgIndex ? { 
          ...m, 
          actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: true } : a) 
        } : m
      ));

      try {
        // 1. NEJDŘÍV zkusit najít existující otázky z aktuální zprávy nebo předchozích
        let existingQuestions: any[] | null = null;
        let existingQuizId: string | null = null;
        let existingQuiz: any = null;
        
        // Získat aktuální akci
        const action = messages[msgIndex].actions?.[actionIndex];
        console.log('[TeacherAssistant] Looking for existing questions in message', msgIndex);
        console.log('[TeacherAssistant] Current action params:', action?.params);
        
        // A) Zkusit najít otázky v params aktuální akce NEBO v obsahu zpráv
        let questionsText: string | null = null;
        
        // 1. Nejdřív zkusit params aktuální akce
        if (action?.params?.questions) {
          questionsText = action.params.questions as string;
          console.log('[TeacherAssistant] Found questions in action params');
        }
        
        // 2. Pokud ne, hledat v obsahu zpráv - najít zprávu s vygenerovanými otázkami
        if (!questionsText) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            // Hledat zprávu která obsahuje číslovené otázky (1. **...**, 2. **...**)
            if (m.role === 'assistant' && /\d+\.\s*\*\*[^*]+\*\*/.test(m.content)) {
              // Zkontrolovat že obsahuje i možnosti
              if (/[-•*]\s*[a-d]\)/.test(m.content)) {
                questionsText = m.content;
                console.log('[TeacherAssistant] Found questions in message', i);
                break;
              }
            }
          }
        }
        
        if (questionsText) {
          console.log('[TeacherAssistant] Parsing questions from text');
          
          // Parsovat textový formát otázek:
          // 1. **Otázka?**
          //    - a) možnost
          //    - b) možnost
          //    - c) možnost
          //    - ✓ Správná: a
          // Rozdělit na bloky podle čísla otázky
          const questionBlocks = questionsText.split(/(?:^|\n)\s*\d+\.\s*\*?\*?/).filter(b => b.trim());
          console.log('[TeacherAssistant] Found question blocks:', questionBlocks.length);
          
          existingQuestions = [];
          for (const block of questionBlocks) {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) continue;
            
            // První řádek je otázka (může končit **)
            const questionLine = lines[0].replace(/\*\*$/, '').trim();
            
            // Najít možnosti (- a), - b), - c), • a), * a))
            const options: string[] = [];
            let correctIndex = 0;
            
            for (const line of lines.slice(1)) {
              // Možnost: - a) text nebo * a) text nebo • a) text
              const optMatch = line.match(/^[-*•]\s*([a-d])\)\s*(.+)/i);
              if (optMatch) {
                options.push(optMatch[2].trim());
                continue;
              }
              // Správná odpověď: ✓ Správná: a nebo Správná: a
              const correctMatch = line.match(/správná[:\s]+([a-d])/i);
              if (correctMatch) {
                const letter = correctMatch[1].toLowerCase();
                correctIndex = letter.charCodeAt(0) - 'a'.charCodeAt(0);
              }
            }
            
            if (questionLine && options.length >= 2) {
              existingQuestions.push({
                question: questionLine,
                options,
                correctIndex
              });
            }
          }
          console.log('[TeacherAssistant] Parsed questions:', existingQuestions.length);
        }
        
        // B) Hledat quizId v actions všech zpráv - od aktuální zpět
        if (!existingQuestions) {
          for (let i = msgIndex; i >= 0; i--) {
            const m = messages[i];
            if (m.actions) {
              const openEditorAction = m.actions.find(a => a.type === 'open_editor' && a.params?.quizId);
              if (openEditorAction) {
                existingQuizId = openEditorAction.params?.quizId;
                console.log('[TeacherAssistant] Found quizId:', existingQuizId);
                break;
              }
            }
          }
        }
        
        // C) Pokud máme quizId, načíst quiz
        if (existingQuizId) {
          const { getQuiz } = await import('../../utils/quiz-storage');
          existingQuiz = getQuiz(existingQuizId);
          console.log('[TeacherAssistant] Loaded existing quiz:', existingQuizId, existingQuiz);
          if (existingQuiz?.slides) {
            // Převést slides na formát otázek
            existingQuestions = existingQuiz.slides
              .filter((s: any) => s.activityType === 'abc')
              .map((s: any) => ({
                question: s.question,
                options: s.options?.map((o: any) => o.content || o.text || o.label) || [],
                correctIndex: s.options?.findIndex((o: any) => o.isCorrect) ?? 0
              }));
            console.log('[TeacherAssistant] Extracted questions from quiz:', existingQuestions);
          }
        }
        
        // Import worksheet types and functions
        const { createEmptyWorksheet } = await import('../../types/worksheet');
        const { saveWorksheet } = await import('../../utils/worksheet-storage');
        
        // Create new worksheet
        const worksheetId = `worksheet_${Date.now()}`;
        const newWorksheet = createEmptyWorksheet(worksheetId);
        
        // Pokud máme existující otázky, převést je na bloky pracovního listu
        if (existingQuestions && existingQuestions.length > 0) {
          console.log('[TeacherAssistant] Converting existing questions to worksheet:', existingQuestions.length, 'questions');
          
          // Najít téma z konverzace
          let worksheetTitle = 'Pracovní list';
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            const linkMatch = m.content.match(/\[([^\]]+)\]\(\/docs\/[^)]+\)/);
            if (linkMatch) {
              worksheetTitle = `Pracovní list: ${linkMatch[1]}`;
              break;
            }
          }
          if (existingQuiz?.title) {
            worksheetTitle = existingQuiz.title.replace('Test:', 'Pracovní list:');
          }
          
          newWorksheet.title = worksheetTitle;
          newWorksheet.subject = existingQuiz?.subject || 'other';
          
          let order = 2;
          const blocks: any[] = [...newWorksheet.blocks.slice(0, 2)];
          
          // Update first heading with title
          if (blocks[1]?.type === 'heading') {
            blocks[1].content.text = worksheetTitle;
          }
          
          // Převést otázky na bloky
          for (const q of existingQuestions) {
            const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            if (q.options && Array.isArray(q.options)) {
              // ABC otázka -> multiple-choice blok
              const options = q.options.map((opt: any, i: number) => ({
                id: `opt-${i}`,
                text: typeof opt === 'string' ? opt : (opt.content || opt.text || opt.label || `Možnost ${i + 1}`),
              }));
              
              const correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
              
              blocks.push({
                id: blockId,
                type: 'multiple-choice',
                order: order++,
                width: 'full',
                content: {
                  question: q.question || '',
                  options,
                  correctAnswers: [correctIdx.toString()],
                  allowMultiple: false,
                  variant: 'text',
                },
              });
            }
          }
          
          newWorksheet.blocks = blocks;
          saveWorksheet(newWorksheet);
          
          console.log('[TeacherAssistant] Worksheet created from existing quiz:', worksheetId);
          navigate(`/library/my-content/worksheet-editor/${worksheetId}`);
          toast.success('Pracovní list vytvořen z testu! Otevírám editor...');
          
          setMessages(prev => prev.map((m, i) => 
            i === msgIndex ? { 
              ...m, 
              actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: false, executed: true } : a) 
            } : m
          ));
          return;
        }
        
        // 2. Pokud nemáme existující quiz, vygenerovat nový pracovní list
        console.log('[TeacherAssistant] No existing quiz found, generating new worksheet');
        
        // Extrahovat téma z konverzace
        let topic = 'obecné téma';
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          const linkMatch = m.content.match(/\[([^\]]+)\]\(\/docs\/[^)]+\)/);
          if (linkMatch) {
            topic = linkMatch[1];
            break;
          }
          if (m.role === 'user' && i < messages.length - 1) {
            topic = m.content.slice(0, 100).trim();
            break;
          }
        }
        
        const worksheetPrompt = `Vytvoř pracovní list na téma "${topic}" pro základní školu.
DŮLEŽITÉ: Pracovní list MUSÍ být přesně na téma "${topic}"!

Odpověz POUZE jako JSON:
{
  "title": "Pracovní list: ${topic}",
  "blocks": [
    {"type": "heading", "text": "${topic}"},
    {"type": "paragraph", "html": "<p>Úvodní text o tématu ${topic}.</p>"},
    {"type": "multiple-choice", "question": "Otázka o ${topic}?", "options": ["A", "B", "C"], "correctIndex": 0},
    {"type": "free-answer", "question": "Otázka?", "lines": 3}
  ]
}`;

        const response = await chatWithAIProxy([
          { role: 'system', content: `Vytvoř pracovní list PŘESNĚ na téma "${topic}". Generuj POUZE JSON.` },
          { role: 'user', content: worksheetPrompt }
        ], 'gemini-3-flash');

        console.log('[TeacherAssistant] Worksheet AI response:', response);

        let jsonStr = response;
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        // Try to extract JSON object
        const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonObjMatch) {
          jsonStr = jsonObjMatch[0];
        }

        const worksheetData = JSON.parse(jsonStr);
        console.log('[TeacherAssistant] Parsed worksheet data:', worksheetData);

        // Create new worksheet (imports already done above)
        const worksheetId2 = `worksheet_${Date.now()}`;
        const newWorksheet2 = createEmptyWorksheet(worksheetId2);
        newWorksheet2.title = worksheetData.title || `Pracovní list: ${topic}`;
        newWorksheet2.subject = 'other';

        // Convert AI blocks to worksheet blocks
        let order2 = 2; // Start after header-footer and initial heading
        const blocks2: any[] = [...newWorksheet2.blocks.slice(0, 2)]; // Keep header and first heading

        // Update first heading with title
        if (blocks2[1]?.type === 'heading') {
          blocks2[1].content.text = worksheetData.title || topic;
        }

        for (const aiBlock of (worksheetData.blocks || [])) {
          const blockId2 = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          if (aiBlock.type === 'heading') {
            blocks2.push({
              id: blockId2,
              type: 'heading',
              order: order2++,
              width: 'full',
              content: { text: aiBlock.text || '', level: 'h2' },
            });
          } else if (aiBlock.type === 'paragraph') {
            blocks2.push({
              id: blockId2,
              type: 'paragraph',
              order: order2++,
              width: 'full',
              content: { html: aiBlock.html || `<p>${aiBlock.text || ''}</p>` },
            });
          } else if (aiBlock.type === 'multiple-choice') {
            const opts = (aiBlock.options || []).map((opt: string, i: number) => ({
              id: `opt-${i}`,
              text: opt,
            }));
            blocks2.push({
              id: blockId2,
              type: 'multiple-choice',
              order: order2++,
              width: 'full',
              content: {
                question: aiBlock.question || '',
                options: opts,
                correctAnswers: [aiBlock.correctIndex?.toString() || '0'],
                allowMultiple: false,
                variant: 'text',
              },
            });
          } else if (aiBlock.type === 'fill-blank') {
            // FillBlankContent requires segments array
            const segs = [
              { type: 'text' as const, content: aiBlock.textBefore || 'Doplň: ' },
              { type: 'blank' as const, id: `blank-${blockId2}`, correctAnswer: aiBlock.correctAnswer || '' },
              { type: 'text' as const, content: aiBlock.textAfter || '.' },
            ];
            blocks2.push({
              id: blockId2,
              type: 'fill-blank',
              order: order2++,
              width: 'full',
              content: {
                segments: segs,
              },
            });
          } else if (aiBlock.type === 'free-answer') {
            blocks2.push({
              id: blockId2,
              type: 'free-answer',
              order: order2++,
              width: 'full',
              content: {
                question: aiBlock.question || '',
                lines: aiBlock.lines || 3,
              },
            });
          }
        }

        newWorksheet2.blocks = blocks2;
        
        // Save worksheet
        saveWorksheet(newWorksheet2);
        console.log('[TeacherAssistant] Worksheet saved:', worksheetId2);

        // Navigate to editor
        navigate(`/library/my-content/worksheet-editor/${worksheetId2}`);
        toast.success('Pracovní list vytvořen! Otevírám editor...');

      } catch (err) {
        console.error('Worksheet generation error:', err);
        toast.error('Nepodařilo se vytvořit pracovní list.');
      } finally {
        setMessages(prev => prev.map((m, i) => 
          i === msgIndex ? { 
            ...m, 
            actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: false, executed: true } : a) 
          } : m
        ));
      }
      return;
    }

    // Pokud jde o akci, která vyžaduje generování obsahu (plán, present)
    if (type === 'plan' || type === 'present') {
      const msg = messages[msgIndex];
      const topicMatch = msg.content.match(/\[(.*?)\]/);
      const topic = topicMatch ? topicMatch[1] : 'téma';

      // Nastavit stav generování
      setMessages(prev => prev.map((m, i) => 
        i === msgIndex ? { 
          ...m, 
          actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: true } : a) 
        } : m
      ));

      try {
        const generationPrompt = `Jako Vividbooks Asistent vytvoř na základě svých znalostí o tématu "${topic}" detailní ${
          type === 'plan' ? 'plán hodiny (45 min) s úvodem, výkladem, procvičováním a shrnutím' : 
          type === 'worksheet' ? 'pracovní list s 5 úkoly různé obtížnosti' : 
          'osnovu prezentace s 8-10 slidy'
        }. 
        Piš česky, profesionálně a strukturovaně v Markdownu. Zahrň konkrétní aktivity a materiály z Vividbooks.`;

        const response = await chatWithAIProxy([
          { role: 'system', content: 'Jsi expert na tvorbu vzdělávacích materiálů Vividbooks. Generuješ detailní a prakticky použitelné materiály pro učitele.' },
          { role: 'user', content: generationPrompt }
        ], 'gemini-3-flash');

        const resultMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, resultMessage]);
        toast.success(`Obsah vygenerován: ${label}`);
      } catch (err) {
        console.error('Generation error:', err);
        toast.error('Nepodařilo se vygenerovat obsah.');
      } finally {
        setMessages(prev => prev.map((m, i) => 
          i === msgIndex ? { 
            ...m, 
            actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: false, executed: true } : a) 
          } : m
        ));
      }
      return;
    }

    if (type === 'assign') {
      const action = messages[msgIndex].actions?.[actionIndex];
      
      console.log('[TeacherAssistant] Assign action clicked:', action);
      
      // If we have assignment data, create it directly
      if (action?.params?.classId && action?.params?.title) {
        console.log('[TeacherAssistant] Creating assignment with params:', action.params);
        
        setMessages(prev => prev.map((m, i) => 
          i === msgIndex ? { 
            ...m, 
            actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: true } : a) 
          } : m
        ));
        
        try {
          const { classId, className, title, description, assignmentType, dueDate, subject } = action.params;
          
          // Get teacher ID from auth
          const stored = localStorage.getItem('sb-njbtqmsxbyvpwigfceke-auth-token');
          let teacherId = 'unknown';
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              teacherId = parsed?.user?.id || 'unknown';
            } catch (e) {}
          }
          
          // Create the assignment
          const assignment = await createAssignment(
            classId,
            title,
            description || '',
            assignmentType || 'document',
            true, // allowAI
            dueDate,
            teacherId,
            subject || context?.category
          );
          
          console.log('[TeacherAssistant] Assignment created:', assignment);
          
          // Add confirmation message
          const confirmMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `✅ **Úkol zadán!**

**${title}**
- Třída: ${className || 'Neznámá'}
- Typ: ${assignmentType === 'document' ? 'Dokument' : assignmentType === 'presentation' ? 'Prezentace' : 'Test'}
${dueDate ? `- Termín: ${new Date(dueDate).toLocaleDateString('cs')}` : ''}

Žáci uvidí úkol na své nástěnce.`,
            actions: [
              { type: 'results' as const, label: '📊 Zobrazit třídu', params: { classId }, executed: false }
            ],
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, confirmMessage]);
          toast.success(`Úkol "${title}" byl zadán třídě ${className}!`);
          
        } catch (err) {
          console.error('[TeacherAssistant] Assignment creation error:', err);
          toast.error('Nepodařilo se vytvořit úkol');
          
          // Fallback to manual creation
          navigate('/library/my-classes?tab=classes&openCreator=true');
        } finally {
          setMessages(prev => prev.map((m, i) => 
            i === msgIndex ? { 
              ...m, 
              actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: false, executed: true } : a) 
            } : m
          ));
        }
        return;
      }
      
      // No params - show error and mark as executed
      console.log('[TeacherAssistant] Assign action missing params:', action?.params);
      toast.error('Chybí údaje pro vytvoření úkolu. Zkuste to znovu.');
      
      // Mark action as executed to remove loading state
      setMessages(prev => prev.map((m, i) => 
        i === msgIndex ? { 
          ...m, 
          actions: m.actions?.map((a, ai) => ai === actionIndex ? { ...a, generating: false, executed: true } : a) 
        } : m
      ));
      return;
    } else if (type === 'analyze' || type === 'results') {
      navigate('/library/my-classes?tab=results');
      toast.success(`Zobrazuji výsledky třídy...`);
    }
    
    setMessages(prev => prev.map((msg, i) => 
      i === msgIndex ? { 
        ...msg, 
        actions: msg.actions?.map((a, ai) => ai === actionIndex ? { ...a, executed: true } : a) 
      } : msg
    ));
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent, customMessage?: string) => {
    e?.preventDefault();
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    // Wait for results context to load if it's still loading (max 5s)
    if (loadingResultsRef.current) {
      console.log('[Assistant] Waiting for results context to load...');
      const startWait = Date.now();
      while (loadingResultsRef.current && Date.now() - startWait < 5000) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (loadingResultsRef.current) {
        console.log('[Assistant] Results context still loading after 5s, proceeding without student data');
      } else {
        console.log('[Assistant] Results context loaded, proceeding with student data');
      }
    }
    console.log('[Assistant] resultsContextRef length:', resultsContextRef.current?.length || 0);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = [...messages, userMessage].slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      // Build context string if available
      const currentContext = context ? `
=== KDE SE UČITEL PRÁVĚ NACHÁZÍ ===
${context.category ? `Předmět/Kategorie: ${context.category}` : ''}
${context.page ? `Aktuální stránka: "${context.page.title}" (${context.page.slug || context.page.id})` : ''}
${context.path ? `URL cesta: ${context.path}` : ''}
(Využij tento kontext pro relevantnější odpovědi - např. pokud je učitel v sekci "Zlomky", nabídni mu obsah souvisejcí se zlomky)
` : '';

      const systemPrompt = `Jsi "Vividbooks Asistent" pro pedagogy.

=== KRITICKÁ PRAVIDLA - DODRŽUJ STRIKTNĚ ===

1. NEVYMÝŠLEJ SI ŽÁKY ANI VÝSLEDKY!
   - Odpovídej POUZE o žácích, kteří jsou v sekci "MOJI ŽÁCI A VÝSLEDKY" níže
   - Pokud žák NENÍ v seznamu, řekni: "Žáka [jméno] jsem v databázi nenašel/nenašla."
   - NIKDY si nevymýšlej procenta, skóre ani hodnocení!
   - Pokud nemáš data, řekni to upřímně

2. NEVYMÝŠLEJ SI LEKCE!
   - Odkazuj POUZE na lekce ze seznamu "DOSTUPNÉ LEKCE"
   - Pokud lekci nenajdeš, řekni: "Tuto lekci nemáme."

3. KDYŽ MLUVÍŠ O VÝSLEDCÍCH:
   - Použij PŘESNÁ čísla z kontextu níže
   - Dej odkaz na profil žáka: [Jméno](/library/student/ID)
   - Dej odkaz na třídu: [Název třídy](/library/my-classes?classId=ID)
   - NEODKAZUJ na lekce jako na výsledky!
${currentContext}
=== MOJI ŽÁCI A VÝSLEDKY ===
${resultsContextRef.current || 'Žádná data o žácích nejsou k dispozici.'}

=== DOSTUPNÉ LEKCE ===
${isLoadingMenu ? 'Seznam lekcí se právě načítá...' : (availableLessons || 'Seznam lekcí je prázdný.')}

=== SCHOPNOSTI ===
1. VYHLEDÁVÁNÍ LEKCÍ: [Název](/docs/predmet/slug)
2. TVORBA TESTU: [BOARD_DATA:{"title":"...","questions":[...]}]
3. INFO O ŽÁCÍCH: Použij POUZE data výše, nic nevymýšlej!

4. ZADÁNÍ ÚKOLU TŘÍDĚ:
   
   KDYŽ UČITEL CHCE ZADAT ÚKOL, POSTUPUJ TAKTO:
   
   A) POKUD CHYBÍ INFORMACE - doptej se:
      Podívej se do kontextu MOJE TŘÍDY A ŽÁCI a zjisti jaké předměty má daná třída.
      Pak se zeptej:
      "Připravím úkol pro třídu [název]. Tato třída má předměty: [seznam předmětů].
      
      Potřebuji vědět:
      1. **Předmět:** Z jakého předmětu? (např. Fyzika, Matematika...)
      2. **Typ:** Písemný dokument, prezentace, nebo test?
      3. **Termín:** Do kdy má být odevzdán?
      4. **Zadání:** Co přesně mají žáci udělat?"
   
   B) POKUD MÁŠ VŠECHNY INFO - vygeneruj ASSIGN_DATA a shrnutí:
      Napiš: "Připravil jsem úkol k zadání:" + shrnutí + ASSIGN_DATA tag
      
      [ASSIGN_DATA:{"classId":"PŘESNÉ_ID_Z_KONTEXTU","className":"NÁZEV","title":"Název úkolu","description":"Detailní zadání","assignmentType":"document","dueDate":"2026-01-15","subject":"Fyzika"}]
   
   ⚠️ KRITICKÉ:
   - NEŘÍKEJ "úkol byl zadán" ani "žáci uvidí" - to se stane AŽ PO KLIKNUTÍ NA TLAČÍTKO!
   - Říkej "Připravil jsem úkol k zadání" nebo "Klikni pro zadání úkolu"
   - classId MUSÍ být přesné ID z kontextu MOJI ŽÁCI A VÝSLEDKY (např. "c_1234567890")
   - Pokud třídu nenajdeš v seznamu, řekni to
   - assignmentType: "document" | "presentation" | "test"
   - subject: Předmět z těch které má třída nastaveny
   - dueDate: formát YYYY-MM-DD

FORMÁT: Česky, stručně, Markdown. POUZE fakta z kontextu!`;

      const response = await chatWithAIProxy([
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ], 'gemini-3-flash');

      // Parse response for potential board data
      let cleanContent = response;
      const actions: Message['actions'] = [];
      
      console.log('[TeacherAssistant] Raw AI response:', response);
      
      // Look for [BOARD_DATA:{...}] - capture everything between first { and matching }
      const boardStartIdx = response.indexOf('[BOARD_DATA:');
      if (boardStartIdx !== -1) {
        const jsonStart = response.indexOf('{', boardStartIdx);
        if (jsonStart !== -1) {
          // Find matching closing brace
          let braceCount = 0;
          let jsonEnd = jsonStart;
          for (let i = jsonStart; i < response.length; i++) {
            if (response[i] === '{') braceCount++;
            if (response[i] === '}') braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
          
          const jsonStr = response.substring(jsonStart, jsonEnd);
          console.log('[TeacherAssistant] Extracted JSON:', jsonStr);
          try {
            const boardData = JSON.parse(jsonStr);
            console.log('[TeacherAssistant] Parsed board data:', boardData);
            console.log('[TeacherAssistant] Questions:', boardData.questions);
            const newQuiz = createEmptyQuiz(crypto.randomUUID());
            newQuiz.title = boardData.title || 'Vygenerovaný test';
            newQuiz.subject = boardData.subject || 'Fyzika';
            newQuiz.grade = boardData.grade || 6;
            
            // Map simplified questions to slides
            if (boardData.questions && Array.isArray(boardData.questions)) {
              newQuiz.slides = boardData.questions.map((q: any, idx: number) => {
                console.log(`[TeacherAssistant] Question ${idx + 1}:`, q);
                console.log(`[TeacherAssistant] Options for Q${idx + 1}:`, q.options);
                
                const options = (q.options && Array.isArray(q.options) && q.options.length > 0) 
                  ? q.options 
                  : ['Odpověď A', 'Odpověď B', 'Odpověď C'];
                
                // ABCOption requires: id, label (A/B/C), content (text), isCorrect
                const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                  
                return {
                  id: crypto.randomUUID(),
                  type: 'activity',
                  activityType: 'abc',
                  order: idx + 1,
                  question: q.question || 'Otázka bez textu',
                  options: options.map((opt: string, oi: number) => ({
                    id: `opt-${oi}`,
                    label: labels[oi] || String(oi + 1), // A, B, C, D...
                    content: String(opt), // CONTENT not text!
                    isCorrect: oi === (q.correctIndex || 0)
                  })),
                  points: 1
                };
              });
              
              console.log('[TeacherAssistant] Created slides:', newQuiz.slides);
            }
            
            saveQuiz(newQuiz);
            
            actions.push({
              type: 'open_editor',
              label: `Otevřít test: ${newQuiz.title}`,
              params: { quizId: newQuiz.id },
              executed: false
            });
            
            // Remove BOARD_DATA from visible content completely
            const boardEndIdx = response.indexOf(']', jsonEnd);
            const fullBoardTag = response.substring(boardStartIdx, boardEndIdx !== -1 ? boardEndIdx + 1 : jsonEnd);
            cleanContent = cleanContent.replace(fullBoardTag, '').trim();
            
            console.log('[TeacherAssistant] Board created:', newQuiz.id, newQuiz.title);
          } catch (e) {
            console.error('Failed to parse board data:', e, jsonStr);
            // Still try to remove malformed BOARD_DATA from display
            cleanContent = cleanContent.replace(/\[BOARD_DATA:[^\]]*\]?/g, '').trim();
          }
        }
      }
      
      // Also clean up any remaining BOARD_DATA artifacts
      cleanContent = cleanContent.replace(/\[BOARD_DATA:[^\]]*\]?/gi, '').trim();

      // Parse [ASSIGN_DATA:{...}] for direct assignment creation
      const assignStartIdx = response.indexOf('[ASSIGN_DATA:');
      if (assignStartIdx !== -1) {
        const assignJsonStart = response.indexOf('{', assignStartIdx);
        if (assignJsonStart !== -1) {
          // Find matching closing brace
          let braceCount = 0;
          let assignJsonEnd = assignJsonStart;
          for (let i = assignJsonStart; i < response.length; i++) {
            if (response[i] === '{') braceCount++;
            if (response[i] === '}') braceCount--;
            if (braceCount === 0) {
              assignJsonEnd = i + 1;
              break;
            }
          }
          
          const assignJsonStr = response.substring(assignJsonStart, assignJsonEnd);
          console.log('[TeacherAssistant] Extracted ASSIGN_DATA:', assignJsonStr);
          
          try {
            const assignData = JSON.parse(assignJsonStr);
            console.log('[TeacherAssistant] Parsed assignment data:', assignData);
            
            // Validate required fields
            if (assignData.classId && assignData.title) {
              actions.push({
                type: 'assign',
                label: `✅ Zadat: ${assignData.title}`,
                params: {
                  classId: assignData.classId,
                  className: assignData.className,
                  title: assignData.title,
                  description: assignData.description || '',
                  assignmentType: assignData.assignmentType || 'document',
                  dueDate: assignData.dueDate,
                  subject: assignData.subject || context?.category
                },
                executed: false
              });
            }
            
            // Remove ASSIGN_DATA from visible content
            const assignEndIdx = response.indexOf(']', assignJsonEnd);
            const fullAssignTag = response.substring(assignStartIdx, assignEndIdx !== -1 ? assignEndIdx + 1 : assignJsonEnd);
            cleanContent = cleanContent.replace(fullAssignTag, '').trim();
            
          } catch (e) {
            console.error('Failed to parse ASSIGN_DATA:', e, assignJsonStr);
            cleanContent = cleanContent.replace(/\[ASSIGN_DATA:[^\]]*\]?/g, '').trim();
          }
        }
      }
      
      // Clean up any remaining ASSIGN_DATA artifacts
      cleanContent = cleanContent.replace(/\[ASSIGN_DATA:[^\]]*\]?/gi, '').trim();

      // Parse response for potential actions - handle multiple formats
      // Format 1: [ACTION:type:label]
      // Format 2: type:label] (AI sometimes forgets the prefix)
      const actionRegex = /\[?ACTION:?([^:\]]+):([^\]]+)\]?/gi;
      let match;
      while ((match = actionRegex.exec(response)) !== null) {
        const actionType = match[1].trim().toLowerCase();
        if (['plan', 'test', 'assign', 'present', 'worksheet', 'analyze'].includes(actionType)) {
          actions.push({
            type: actionType as any,
            label: match[2].trim(),
            executed: false
          });
        }
      }
      
      // Also catch simple format: plan:Label] test:Label]
      const simpleActionRegex = /\b(plan|test|assign|present|worksheet):([^\]]+)\]/gi;
      while ((match = simpleActionRegex.exec(response)) !== null) {
        const actionType = match[1].trim().toLowerCase();
        // Avoid duplicates
        if (!actions.some(a => a.type === actionType)) {
          actions.push({
            type: actionType as any,
            label: match[2].trim(),
            executed: false
          });
        }
      }
      
      // Clean all action-related text from content
      cleanContent = cleanContent
        .replace(/\[?ACTION:?[^:\]]+:[^\]]+\]?/gi, '')
        .replace(/\b(plan|test|assign|present|worksheet):([^\]]+)\]/gi, '')
        .trim();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: cleanContent,
        actions: actions.length > 0 ? actions : undefined,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Teacher Assistant Error:', err);
      toast.error('Omlouvám se, ale nepodařilo se mi zpracovat váš požadavek.');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  // Listen for external commands (from DocumentationLayout)
  useEffect(() => {
    const handleNewChat = () => startNewChat();
    const handleToggleHistory = () => {
      setShowHistory(prev => !prev);
      if (!showHistory) loadChatHistory();
    };

    window.addEventListener('ai-assistant-new-chat', handleNewChat);
    window.addEventListener('ai-assistant-toggle-history', handleToggleHistory);

    return () => {
      window.removeEventListener('ai-assistant-new-chat', handleNewChat);
      window.removeEventListener('ai-assistant-toggle-history', handleToggleHistory);
    };
  }, [showHistory, loadChatHistory]);

  const isIntegrated = mode === 'integrated';

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* History & New Chat buttons for integrated mode - top right, positioned higher */}
      {isIntegrated && (
        <div className="absolute top-0 right-4 z-10 flex items-center gap-2 pt-2">
          <button
            onClick={() => {
              setShowHistory(true);
              loadChatHistory();
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Historie chatů"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historie</span>
          </button>
          <button
            onClick={startNewChat}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Nový chat"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Nový chat</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className={isIntegrated ? "max-w-3xl mx-auto w-full px-6 py-8 flex-1" : "p-4 space-y-6 flex-1"}>
          
          {/* Hero State - Welcome Screen */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-6 animate-in fade-in duration-500">
              {/* SIDEBAR MODE: Simplified contextual design - compact vertical list */}
              {!isIntegrated && context?.category && context.category !== 'knihovna-vividbooks' ? (
                <>
                  {/* Context-aware welcome for sidebar - compact */}
                  <div className="w-full px-4 mb-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      {context.category && context.category !== 'knihovna-vividbooks' && (
                        <span className="capitalize">{context.category.replace(/-/g, ' ')}</span>
                      )}
                      {(context.page?.title || context.folderTitle) && context.category && ' → '}
                    </p>
                    <h2 className="text-lg font-bold text-[#4E5871]" style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}>
                      {context.page?.title || context.folderTitle || context.category?.replace(/-/g, ' ') || 'Knihovna'}
                    </h2>
                  </div>

                  {/* Compact vertical list for sidebar */}
                  {(() => {
                    const currentTopic = context.page?.title || context.folderTitle || context.category;
                    return (
                      <div className="w-full px-3 space-y-2">
                        <button
                          onClick={() => handleSubmit(undefined, `Vytvoř test z tématu "${currentTopic}"`)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                            <FileQuestion className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-700 text-sm">Vytvořit test</span>
                        </button>

                        <button
                          onClick={() => handleSubmit(undefined, `Vytvoř pracovní list z tématu "${currentTopic}"`)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-sm transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <FileEdit className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-700 text-sm">Pracovní list</span>
                        </button>

                        <button
                          onClick={() => handleSubmit(undefined, `Zadej úkol třídě z tématu "${currentTopic}"`)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100 hover:border-amber-200 hover:shadow-sm transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-700 text-sm">Zadat úkol třídě</span>
                        </button>

                        <button
                          onClick={() => handleSubmit(undefined, 'Ukaž mi výsledky žáků')}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100 hover:border-orange-200 hover:shadow-sm transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-700 text-sm">Výsledky žáků</span>
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : !isIntegrated ? (
                <>
                  {/* Sidebar without context - compact welcome */}
                  <div 
                    className="mb-3 w-10 h-10 bg-white flex items-center justify-center shadow-sm border-2 border-amber-200"
                    style={{ borderRadius: '12px' }}
                  >
                    <Sparkle className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </div>

                  <h1 
                    className="text-lg font-bold mb-1 tracking-tight text-center text-[#4E5871]"
                    style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}
                  >
                    S čím vám mohu pomoct?
                  </h1>
                  <p className="text-muted-foreground mb-4 text-center text-[11px] leading-relaxed px-4">
                    Vyberte z nabídky nebo napište dotaz
                  </p>

                  {/* Compact vertical list for sidebar */}
                  <div className="w-full px-3 space-y-1.5">
                    {suggestions.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(undefined, item.query)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group"
                      >
                        <div 
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: item.bgColor || (item.color + '20'), color: item.color }}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-slate-700 text-xs">{item.title}</span>
                        <span className="text-slate-400 text-[10px] ml-auto truncate max-w-[80px]">{item.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* INTEGRATED MODE: Full original design */}
                  <div 
                    className="mb-8 w-16 h-16 bg-white flex items-center justify-center shadow-md border-2 border-amber-200"
                    style={{ borderRadius: '22px' }}
                  >
                    <Sparkle className="w-9 h-9 text-amber-400 fill-amber-400" />
                  </div>

                  <h1 
                    className="text-3xl md:text-4xl font-bold mb-3 tracking-tight text-center text-[#4E5871]"
                    style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}
                  >
                    Vítejte ve Vividbooks
                  </h1>
                  <p className="text-muted-foreground mb-8 max-w-md text-center text-sm md:text-base leading-relaxed">
                    Otevřete si naše materiály s doložkou MŠMT v levém menu.<br />
                    Nebo si zde vytvořte něco podle sebe.
                  </p>

                  {/* Full action cards grid - original design */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                    {suggestions.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(undefined, item.query)}
                        className="group flex items-center gap-4 p-5 bg-white border border-transparent hover:shadow-lg transition-all text-left"
                        style={{ 
                          backgroundColor: item.bgColor.replace('20', '08'),
                          border: `1.5px solid ${item.borderColor}40`,
                          borderRadius: '16px'
                        }}
                      >
                        <div 
                          className="w-12 h-12 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm"
                          style={{ 
                            backgroundColor: item.color, 
                            color: 'white',
                            borderRadius: '10px'
                          }}
                        >
                          <item.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base mb-0.5 text-slate-800">{item.title}</h3>
                          <p className="text-[11px] text-slate-500 leading-snug">{item.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Message List */}
          <div className="space-y-8">
            {messages.map((msg, i) => (
              <div 
                key={msg.id} 
                className={`flex gap-4 md:gap-6 ${isIntegrated ? '' : msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' 
                    : 'bg-indigo-600 text-white'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 md:w-6 md:h-6" /> : <Sparkles className="w-5 h-5 md:w-6 md:h-6" />}
                </div>
                
                <div className="flex-1 space-y-3 min-w-0">
                  <div className={`text-[15px] leading-relaxed ${
                    msg.role === 'assistant' ? '' : 'font-medium pt-1'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <HtmlRenderer content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                  
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                        <Zap className="w-3 h-3 fill-slate-500" />
                        Co chcete udělat?
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.actions.map((action, ai) => (
                          <Button 
                            key={ai}
                            onClick={() => handleAction(action.type, action.label, i, ai)}
                            disabled={action.executed || action.generating}
                            size="sm"
                            className={`rounded-full px-4 h-9 font-bold transition-all shadow-sm ${
                              action.executed 
                              ? 'bg-emerald-500 text-white hover:bg-emerald-500' 
                              : action.generating
                              ? 'bg-indigo-100 text-indigo-400 animate-pulse'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-600/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {action.generating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  {action.type === 'assign' && <ClipboardList className="w-3.5 h-3.5" />}
                                  {action.type === 'analyze' && <BarChart3 className="h-3.5 w-3.5" />}
                                  {action.type === 'results' && <BarChart3 className="h-3.5 w-3.5" />}
                                  {action.type === 'plan' && <GraduationCap className="h-3.5 w-3.5" />}
                                  {action.type === 'present' && <Presentation className="h-3.5 w-3.5" />}
                                  {action.type === 'test' && <FileQuestion className="h-3.5 w-3.5" />}
                                  {action.type === 'worksheet' && <FileEdit className="h-3.5 w-3.5" />}
                                </>
                              )}
                              <span className="text-xs">{action.generating ? 'Generuji...' : action.executed ? 'Hotovo' : action.label}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 md:gap-6 animate-pulse">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/30 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
                <div className="flex-1 space-y-2 py-2 md:py-3">
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-[90%]" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-[70%]" />
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Always at bottom, fixed position with solid background to overlay content */}
      <div className={isIntegrated ? "pb-8 pt-4 bg-background border-t border-border/10 shrink-0 sticky bottom-0 z-0" : "p-4 border-t border-border bg-card shrink-0"}>
        <div className={isIntegrated ? "max-w-3xl mx-auto w-full px-6" : ""}>
          <form 
            onSubmit={handleSubmit} 
            className={`flex items-end gap-3 p-3 rounded-2xl transition-all border shadow-sm focus-within:shadow-lg focus-within:border-indigo-400 ${
              isIntegrated ? 'bg-card border-border' : 'bg-accent/30 border-transparent'
            }`}
          >
            {isLoadingMenu && (
              <div className="flex items-center gap-2 text-muted-foreground animate-pulse shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={isLoadingMenu ? "Načítám obsah knihovny..." : (messages.length === 0 ? "Napište, s čím vám mohu pomoct..." : "Pokračujte v konverzaci...")}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none resize-none py-2 px-2 text-base custom-scrollbar max-h-[200px] placeholder:text-muted-foreground/60"
              disabled={isLoading || isLoadingMenu}
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              size="icon"
              className={`rounded-xl shrink-0 transition-all ${
                input.trim() 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25' 
                  : 'bg-muted text-muted-foreground'
              } ${isIntegrated ? 'w-10 h-10' : 'w-9 h-9'}`}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
          
          {isIntegrated && (
            <p className="text-center text-[11px] text-muted-foreground mt-3">
              Vividbooks AI může dělat chyby. Vždy si ověřte důležité informace.
            </p>
          )}
        </div>
      </div>

      {/* History Panel - fixed to viewport to cover everything, moved to end of JSX and used Portal */}
      {showHistory && createPortal(
        <div className="fixed inset-0 z-[9999] flex animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          {/* Panel - on right side */}
          <div className="w-80 md:w-96 h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-bold text-lg">Historie chatů</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Načítám historii...</p>
                </div>
              ) : chatSessions.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground font-medium">Zatím žádné chaty</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Zde se objeví vaše předchozí konverzace.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chatSessions.map(session => (
                    <div
                      key={session.id}
                      className={`group p-4 rounded-2xl cursor-pointer transition-all border ${
                        currentSessionId === session.id 
                          ? 'bg-primary/5 border-primary/20 shadow-sm' 
                          : 'bg-card border-transparent hover:bg-muted/50 hover:border-border'
                      }`}
                      onClick={() => loadSession(session)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate text-foreground/90">{session.title || 'Nový chat'}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold">
                              {session.messages.length} {session.messages.length === 1 ? 'zpráva' : session.messages.length < 5 ? 'zprávy' : 'zpráv'}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 font-medium">
                              {new Date(session.updatedAt).toLocaleDateString('cs')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Smazat tento chat?')) {
                              deleteSession(session.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-xl hover:bg-destructive/10 flex items-center justify-center transition-all"
                          title="Smazat chat"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Removed footer button from history panel as requested */}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
