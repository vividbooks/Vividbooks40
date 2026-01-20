import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Users, 
  Radio, 
  Square, 
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  UserPlus,
  QrCode,
  Copy,
  Check,
  Lock,
  Unlock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { MOCK_CLASSES } from '../../types/classroom-share';
import * as FirebaseSync from '../../utils/classroom-firebase';

interface TeacherPanelProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentPath: string;
}

export function FirebaseTeacherPanel({ isOpen, onClose, documentTitle, documentPath }: TeacherPanelProps) {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [showClassSelector, setShowClassSelector] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [connectedStudents, setConnectedStudents] = useState<FirebaseSync.ConnectedStudent[]>([]);
  const [showQRCode, setShowQRCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [studentCanControl, setStudentCanControl] = useState(true); // Student control toggle - default unlocked
  
  const sessionRef = useRef<string>('');
  const scrollThrottle = useRef<NodeJS.Timeout | null>(null);

  // Start sharing
  const handleStartSharing = useCallback(async () => {
    if (!selectedClass) return;
    
    const classInfo = MOCK_CLASSES.find(c => c.id === selectedClass);
    if (!classInfo) return;

    const newSessionId = await FirebaseSync.createSession(
      selectedClass,
      classInfo.name,
      'teacher-1',
      'Učitel',
      documentPath,
      documentTitle
    );

    if (newSessionId) {
      setSessionId(newSessionId);
      sessionRef.current = newSessionId;
      setIsSharing(true);
      setShowClassSelector(false);
      
      // Store session ID for animation sync
      localStorage.setItem('vivid-active-session-id', newSessionId);
    }
  }, [selectedClass, documentPath, documentTitle]);

  // Stop sharing
  const handleStopSharing = useCallback(async () => {
    if (sessionRef.current) {
      await FirebaseSync.endSession(sessionRef.current);
    }
    setIsSharing(false);
    setSessionId('');
    sessionRef.current = '';
    setConnectedStudents([]);
    setShowClassSelector(true);
    
    // Clear session ID for animation sync
    localStorage.removeItem('vivid-active-session-id');
  }, []);

  // Toggle student control
  const toggleStudentControl = useCallback(() => {
    const newValue = !studentCanControl;
    setStudentCanControl(newValue);
    
    if (sessionRef.current) {
      FirebaseSync.updateStudentCanControl(sessionRef.current, newValue);
    }
  }, [studentCanControl]);

  // Subscribe to session updates when sharing
  useEffect(() => {
    if (!isSharing || !sessionId) return;

    console.log('Subscribing to session:', sessionId);

    const unsubscribe = FirebaseSync.subscribeToSession(sessionId, (session) => {
      if (!session) return;

      // Convert students object to array, filter out invalid entries
      const students = session.students 
        ? Object.values(session.students).filter(s => s && s.id) 
        : [];
      
      setConnectedStudents(students);
    });

    return () => {
      console.log('Unsubscribing from session');
      unsubscribe();
    };
  }, [isSharing, sessionId]);

  // Send heartbeat while sharing
  useEffect(() => {
    if (!isSharing || !sessionRef.current) return;

    const heartbeat = setInterval(() => {
      if (sessionRef.current) {
        FirebaseSync.sendTeacherHeartbeat(sessionRef.current);
      }
    }, 2000);

    return () => clearInterval(heartbeat);
  }, [isSharing]);

  // Track scroll position as PERCENTAGE - works across different screen sizes
  useEffect(() => {
    if (!isSharing || !sessionRef.current) return;

    let lastSentPercent = 0;
    
    const handleScroll = () => {
      if (scrollThrottle.current) return;

      scrollThrottle.current = setTimeout(() => {
        if (sessionRef.current) {
          // Calculate scroll percentage (0-100)
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          
          // Only send if percentage changed significantly (more than 0.5%)
          if (Math.abs(scrollPercent - lastSentPercent) > 0.5) {
            lastSentPercent = scrollPercent;
            console.log('[Teacher] Sending scroll %:', scrollPercent.toFixed(1));
            FirebaseSync.updateSessionScroll(sessionRef.current, scrollPercent);
          }
        }
        scrollThrottle.current = null;
      }, 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollThrottle.current) {
        clearTimeout(scrollThrottle.current);
      }
    };
  }, [isSharing]);

  // Update path when document changes
  useEffect(() => {
    if (!isSharing || !sessionRef.current) return;
    
    FirebaseSync.updateSessionPath(sessionRef.current, documentPath, documentTitle);
  }, [isSharing, documentPath, documentTitle]);

  // Track text selection
  useEffect(() => {
    if (!isSharing || !sessionRef.current) return;

    let selectionTimeout: NodeJS.Timeout | null = null;

    const handleSelectionChange = () => {
      // Debounce selection changes
      if (selectionTimeout) clearTimeout(selectionTimeout);
      
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        
        if (selectedText && selectedText.length > 0) {
          // Get a simple path to help locate the text
          const range = selection?.getRangeAt(0);
          const container = range?.commonAncestorContainer;
          const containerPath = container?.parentElement?.closest('[data-section], article, main')?.getAttribute('data-section') || 'content';
          
          FirebaseSync.updateTextSelection(sessionRef.current, {
            text: selectedText,
            startOffset: range?.startOffset || 0,
            endOffset: range?.endOffset || 0,
            containerPath,
            timestamp: Date.now()
          });
          console.log('[Teacher] Text selected:', selectedText.substring(0, 50) + '...');
        } else {
          // Clear selection
          FirebaseSync.updateTextSelection(sessionRef.current, null);
        }
      }, 300);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeout) clearTimeout(selectionTimeout);
    };
  }, [isSharing]);

  // Stop sharing on close/unload
  useEffect(() => {
    const handleUnload = () => {
      if (sessionRef.current) {
        // Can't use async here, so we just try to end it
        FirebaseSync.endSession(sessionRef.current);
        localStorage.removeItem('vivid-active-session-id');
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      // Also stop when component unmounts
      if (sessionRef.current) {
        FirebaseSync.endSession(sessionRef.current);
        localStorage.removeItem('vivid-active-session-id');
      }
    };
  }, []);

  const activeStudents = connectedStudents.filter(s => s.isActive).length;
  const inactiveStudents = connectedStudents.filter(s => !s.isActive);

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col text-white">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className={`w-5 h-5 ${isSharing ? 'text-red-400 animate-pulse' : 'text-white/70'}`} />
          <span className="font-semibold">Sdílení ve třídě</span>
          {isSharing && <span className="text-xs text-emerald-400">(Firebase)</span>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Class Selector */}
        <div className="p-4">
          <button
            onClick={() => !isSharing && setShowClassSelector(!showClassSelector)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-600 hover:bg-slate-500 transition-colors"
          >
            <span className="font-medium">
              {isSharing ? `Třída ${MOCK_CLASSES.find(c => c.id === selectedClass)?.name}` : 'Připojit studenty'}
            </span>
            {!isSharing && (showClassSelector ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />)}
          </button>

          {showClassSelector && !isSharing && (
            <div className="mt-3 space-y-2">
              {MOCK_CLASSES.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    selectedClass === cls.id
                      ? 'bg-emerald-500/30 border border-emerald-400'
                      : 'bg-slate-700/50 hover:bg-slate-600/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white/70" />
                    <span>{cls.name}</span>
                  </div>
                  <span className="text-sm text-white/60">{cls.studentCount} žáků</span>
                </button>
              ))}
              
              {selectedClass && (
                <button
                  onClick={handleStartSharing}
                  className="w-full mt-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-white"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <Radio className="w-5 h-5" />
                  Začít živé vysílání
                </button>
              )}
            </div>
          )}
        </div>

        {/* QR Code for joining */}
        {isSharing && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                <span className="font-medium">QR kód pro připojení</span>
              </div>
              {showQRCode ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {showQRCode && (
              <div className="mt-3 p-4 bg-white rounded-xl flex flex-col items-center">
                <QRCodeSVG 
                  value={`${window.location.origin}${import.meta.env.BASE_URL || '/'}join/${sessionId}`}
                  size={180}
                  level="M"
                  includeMargin={true}
                />
                <p className="text-slate-600 text-sm mt-2 text-center">
                  Naskenujte pro připojení
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL || '/'}join/${sessionId}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Zkopírováno!' : 'Kopírovat odkaz'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Student Control Toggle */}
        {isSharing && (
          <div className="px-4 pb-4">
            <button
              onClick={toggleStudentControl}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                studentCanControl 
                  ? 'bg-emerald-500/20 border border-emerald-400/30' 
                  : 'bg-slate-700/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                {studentCanControl ? (
                  <Unlock className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Lock className="w-5 h-5 text-white/70" />
                )}
                <div className="text-left">
                  <div className="font-medium text-sm">
                    {studentCanControl ? 'Student může ovládat' : 'Student nemůže ovládat'}
                  </div>
                  <div className="text-xs text-white/50">
                    {studentCanControl ? 'Scroll a animace povoleny' : 'Pouze sledování'}
                  </div>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${
                studentCanControl ? 'bg-emerald-500' : 'bg-slate-600'
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  studentCanControl ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </button>
          </div>
        )}

        {/* Connected Students */}
        {isSharing && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Studenti</h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{connectedStudents.length}</span>
                <Users className="w-5 h-5 text-white/70" />
              </div>
            </div>

            {/* Status summary */}
            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Eye className="w-4 h-4" />
                <span>{activeStudents} sleduje</span>
              </div>
              {inactiveStudents.length > 0 && (
                <div className="flex items-center gap-1.5 text-orange-400">
                  <EyeOff className="w-4 h-4" />
                  <span>{inactiveStudents.length} nesoustředí se</span>
                </div>
              )}
            </div>

            {/* Student list */}
            <div className="space-y-1.5">
              {connectedStudents.filter(s => s && s.id).map((student) => (
                <div
                  key={student.id}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    student.isActive 
                      ? 'bg-slate-700/50 text-white' 
                      : 'bg-orange-500 text-white shadow-lg'
                  }`}
                >
                  <span className="font-medium">{student.name || `Student ${student.id.slice(-4)}`}</span>
                  {!student.isActive && <EyeOff className="w-4 h-4" />}
                </div>
              ))}
            </div>

            {connectedStudents.length === 0 && (
              <div className="text-center text-white/50 py-8">
                <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Čekám na připojení studentů...</p>
                <p className="text-sm mt-1">Naskenujte QR kód výše</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - Stop button */}
      {isSharing && (
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleStopSharing}
            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300"
          >
            <Square className="w-4 h-4" />
            Ukončit sdílení
          </button>
        </div>
      )}
    </div>
  );
}

