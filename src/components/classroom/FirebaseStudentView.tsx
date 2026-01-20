import { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Lock, Unlock } from 'lucide-react';
import { useViewMode } from '../../contexts/ViewModeContext';
import * as FirebaseSync from '../../utils/classroom-firebase';

// Get or create student ID
function getStudentId(): string {
  let id = localStorage.getItem('vivid-student-id');
  if (!id) {
    id = `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('vivid-student-id', id);
  }
  return id;
}

// Get student name - priority: student profile > user profile > cached > random
function getStudentName(): string {
  // 1. Check student-specific profile first (saved when switching to student mode)
  try {
    const studentProfile = localStorage.getItem('vividbooks_student_profile');
    if (studentProfile) {
      const parsed = JSON.parse(studentProfile);
      if (parsed.name) {
        console.log('[Student] Found name in vividbooks_student_profile:', parsed.name);
        return parsed.name;
      }
    }
  } catch (e) {}
  
  // 2. Try the main profile storage key (teacher/general profile)
  try {
    const currentProfile = localStorage.getItem('vividbooks_current_user_profile');
    if (currentProfile) {
      const parsed = JSON.parse(currentProfile);
      if (parsed.name) {
        console.log('[Student] Found name in vividbooks_current_user_profile:', parsed.name);
        return parsed.name;
      }
    }
  } catch (e) {}
  
  // 3. No profile name found - generate and save permanently
  const names = ['Jan Novák', 'Eva Svobodová', 'Petr Hloubavý', 'Marie Veselá', 'Tomáš Černý', 'Anna Bílá'];
  const randomName = names[Math.floor(Math.random() * names.length)];
  // Save it so it stays consistent
  localStorage.setItem('vividbooks_student_profile', JSON.stringify({ name: randomName }));
  console.log('[Student] Generated and saved display name:', randomName);
  return randomName;
}

export function FirebaseStudentView() {
  const { viewMode } = useViewMode();
  const isStudent = viewMode === 'student';
  
  // UI state
  const [isControlled, setIsControlled] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [canControl, setCanControl] = useState(true); // Can student scroll/interact? - default unlocked
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  
  // Refs for sync data (to avoid re-renders)
  const studentId = useRef(getStudentId());
  const currentSessionId = useRef<string | null>(null);
  const lastScrollPosition = useRef(0);
  const lastDocumentPath = useRef('');
  const isJoined = useRef(false);
  const lastCanControlRef = useRef<boolean | null>(true); // Track last control value - default unlocked
  
  // Scroll blocking refs - defined early so subscription callback can use them
  const scrollBlockedRef = useRef(false);
  const savedScrollY = useRef(0);
  
  // Get fresh name each time (in case profile updated)
  const getDisplayName = () => getStudentName();

  // Main subscription effect
  useEffect(() => {
    if (!isStudent) {
      setIsControlled(false);
      return;
    }

    console.log('[Student] Starting subscription, studentId:', studentId.current);

    // Check for QR code join
    const qrSessionId = localStorage.getItem('vivid-join-session');
    if (qrSessionId) {
      localStorage.removeItem('vivid-join-session');
      console.log('[Student] Found QR session:', qrSessionId);
    }

    const unsubscribe = FirebaseSync.subscribeToActiveSessions((session) => {
      // No active session
      if (!session) {
        if (isControlled) {
          console.log('[Student] Session ended');
          setIsControlled(false);
          currentSessionId.current = null;
          isJoined.current = false;
        }
        return;
      }

      console.log('[Student] Session update:', {
        id: session.id,
        path: session.documentPath,
        scroll: session.scrollPosition,
        teacher: session.teacherName
      });

      // Update teacher name
      if (session.teacherName !== teacherName) {
        setTeacherName(session.teacherName || 'Učitel');
      }
      
      // Update control permission - ALWAYS update localStorage and state
      const newCanControl = session.studentCanControl === true;
      console.log('[Student] Control from Firebase:', session.studentCanControl, '-> parsed:', newCanControl);
      localStorage.setItem('vivid-student-can-control', newCanControl ? 'true' : 'false');
      
      // Use ref to detect actual changes (avoids closure issue)
      if (lastCanControlRef.current !== newCanControl) {
        console.log('[Student] Control permission CHANGED:', lastCanControlRef.current, '->', newCanControl);
        lastCanControlRef.current = newCanControl;
        setCanControl(newCanControl);
        
        // Dispatch event immediately for animation player
        console.log('[Student] Dispatching studentControlChanged event with:', newCanControl);
        window.dispatchEvent(new CustomEvent('studentControlChanged', { 
          detail: { canControl: newCanControl } 
        }));
      } else {
        console.log('[Student] Control unchanged:', newCanControl);
      }
      
      // Handle text selection highlight
      if (session.textSelection?.text) {
        setHighlightedText(session.textSelection.text);
      } else {
        setHighlightedText(null);
      }

      // Join session if not joined yet
      if (!isJoined.current || currentSessionId.current !== session.id) {
        console.log('[Student] Joining session:', session.id);
        currentSessionId.current = session.id;
        isJoined.current = true;
        setIsControlled(true);
        
        // Register student in Firebase with current display name
        const displayName = getDisplayName();
        console.log('[Student] Registering with name:', displayName);
        FirebaseSync.joinSession(
          session.id,
          studentId.current,
          displayName
        ).catch(err => console.error('[Student] Failed to join:', err));
      }

      // Handle navigation - only if path actually changed
      if (session.documentPath && session.documentPath !== lastDocumentPath.current) {
        lastDocumentPath.current = session.documentPath;
        const currentPath = window.location.pathname;
        
        if (currentPath !== session.documentPath) {
          console.log('[Student] Navigating from', currentPath, 'to', session.documentPath);
          // Use soft navigation
          const url = new URL(window.location.href);
          url.pathname = session.documentPath;
          url.searchParams.set('reader', 'true');
          window.history.replaceState(null, '', url.toString());
          window.location.reload();
        }
      }

      // Handle scroll sync - scrollPosition is now a PERCENTAGE (0-100)
      // This ALWAYS syncs from teacher, regardless of student control state
      if (typeof session.scrollPosition === 'number') {
        const scrollPercent = session.scrollPosition;
        const diff = Math.abs(scrollPercent - lastScrollPosition.current);
        
        if (diff > 0.3) { // Only scroll if percentage changed significantly
          lastScrollPosition.current = scrollPercent;
          
          // Check if body is fixed (scroll blocked)
          const isBodyFixed = document.body.style.position === 'fixed';
          
          // When body is fixed, we need to use a stored/calculated doc height
          // because scrollHeight changes when body is fixed
          let docHeight: number;
          if (isBodyFixed) {
            // Temporarily remove fixed to calculate correct height
            const savedTop = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            docHeight = document.documentElement.scrollHeight - window.innerHeight;
            document.body.style.position = 'fixed';
            document.body.style.top = savedTop;
          } else {
            docHeight = document.documentElement.scrollHeight - window.innerHeight;
          }
          
          const targetScroll = (scrollPercent / 100) * docHeight;
          
          console.log('[Student] Scrolling to:', scrollPercent.toFixed(1) + '%', '=', Math.round(targetScroll) + 'px', isBodyFixed ? '(body fixed)' : '');
          
          if (isBodyFixed) {
            // When body is fixed, update top position instead
            document.body.style.top = `-${targetScroll}px`;
            savedScrollY.current = targetScroll;
          } else {
            window.scrollTo({
              top: targetScroll,
              behavior: 'auto'
            });
          }
        }
      }
    });

    // Cleanup
    return () => {
      console.log('[Student] Cleaning up subscription');
      unsubscribe();
      
      if (currentSessionId.current && isJoined.current) {
        FirebaseSync.leaveSession(currentSessionId.current, studentId.current)
          .catch(err => console.error('[Student] Failed to leave:', err));
      }
    };
  }, [isStudent]); // Only depend on isStudent, not on isControlled or teacherName

  // Heartbeat for activity tracking
  useEffect(() => {
    if (!isStudent || !isControlled || !currentSessionId.current) return;

    const heartbeat = setInterval(() => {
      if (currentSessionId.current) {
        FirebaseSync.updateStudentStatus(
          currentSessionId.current,
          studentId.current,
          document.visibilityState === 'visible'
        ).catch(() => {});
      }
    }, 2000);

    return () => clearInterval(heartbeat);
  }, [isStudent, isControlled]);

  // Highlight text from teacher selection
  useEffect(() => {
    if (!highlightedText) {
      // Remove any existing highlights
      document.querySelectorAll('.teacher-highlight').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el);
          parent.normalize();
        }
      });
      // Clear CSS Highlight API highlights
      if (CSS.highlights) {
        CSS.highlights.delete('teacher-selection');
      }
      return;
    }

    // Find and highlight the text in the document
    const highlightText = (text: string) => {
      // Remove old highlights first
      document.querySelectorAll('.teacher-highlight').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el);
          parent.normalize();
        }
      });

      // Use CSS Highlight API if available, otherwise use mark elements
      if ('Highlight' in window && CSS.highlights) {
        try {
          const mainContent = document.querySelector('main') || document.body;
          const ranges: Range[] = [];
          
          // Find all occurrences
          const walker = document.createTreeWalker(mainContent, NodeFilter.SHOW_TEXT);
          let fullText = '';
          const textNodes: { node: Text; start: number }[] = [];
          
          let node: Text | null;
          while ((node = walker.nextNode() as Text)) {
            textNodes.push({ node, start: fullText.length });
            fullText += node.textContent || '';
          }
          
          // Find the text position
          const index = fullText.indexOf(text);
          if (index !== -1) {
            let currentPos = 0;
            let startNode: Text | null = null;
            let startOffset = 0;
            let endNode: Text | null = null;
            let endOffset = 0;
            
            for (const { node, start } of textNodes) {
              const nodeEnd = start + (node.textContent?.length || 0);
              
              // Find start node
              if (!startNode && index >= start && index < nodeEnd) {
                startNode = node;
                startOffset = index - start;
              }
              
              // Find end node
              const endIndex = index + text.length;
              if (endIndex > start && endIndex <= nodeEnd) {
                endNode = node;
                endOffset = endIndex - start;
                break;
              }
            }
            
            if (startNode && endNode) {
              const range = document.createRange();
              range.setStart(startNode, startOffset);
              range.setEnd(endNode, endOffset);
              ranges.push(range);
            }
          }
          
          if (ranges.length > 0) {
            const highlight = new (window as any).Highlight(...ranges);
            CSS.highlights.set('teacher-selection', highlight);
            
            // Add CSS for the highlight
            if (!document.getElementById('teacher-highlight-style')) {
              const style = document.createElement('style');
              style.id = 'teacher-highlight-style';
              style.textContent = '::highlight(teacher-selection) { background-color: #93c5fd; }';
              document.head.appendChild(style);
            }
            console.log('[Student] Text highlighted using CSS Highlight API');
            return;
          }
        } catch (e) {
          console.log('[Student] CSS Highlight API failed, using fallback:', e);
        }
      }

      // Fallback: Search in main content area using mark elements
      const mainContent = document.querySelector('main') || document.body;
      const walker = document.createTreeWalker(mainContent, NodeFilter.SHOW_TEXT);
      
      let node: Text | null;
      while ((node = walker.nextNode() as Text)) {
        const nodeText = node.textContent || '';
        const index = nodeText.indexOf(text);
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);
          
          const highlight = document.createElement('mark');
          highlight.className = 'teacher-highlight';
          highlight.style.cssText = 'background-color: #93c5fd; padding: 2px 0; border-radius: 2px;';
          
          try {
            range.surroundContents(highlight);
            console.log('[Student] Text highlighted using mark element');
          } catch (e) {
            console.log('[Student] Could not highlight text:', e);
          }
          break;
        }
      }
    };

    highlightText(highlightedText);
  }, [highlightedText]);

  // Block scroll function - stable reference
  const blockScrollHandler = useCallback((e: Event) => {
    if (scrollBlockedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, []);

  const blockKeysHandler = useCallback((e: KeyboardEvent) => {
    if (scrollBlockedRef.current) {
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (scrollKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, []);

  // Setup event listeners once
  useEffect(() => {
    document.addEventListener('wheel', blockScrollHandler, { passive: false, capture: true });
    document.addEventListener('touchmove', blockScrollHandler, { passive: false, capture: true });
    window.addEventListener('keydown', blockKeysHandler, { capture: true });

    return () => {
      document.removeEventListener('wheel', blockScrollHandler, { capture: true } as EventListenerOptions);
      document.removeEventListener('touchmove', blockScrollHandler, { capture: true } as EventListenerOptions);
      window.removeEventListener('keydown', blockKeysHandler, { capture: true } as EventListenerOptions);
    };
  }, [blockScrollHandler, blockKeysHandler]);

  // Update scroll blocking based on canControl - SINGLE effect for all body styles
  useEffect(() => {
    if (!isStudent || !isControlled) return;
    
    const shouldBlock = !canControl;
    
    console.log('[Student] Control state changed:', { shouldBlock, canControl, refValue: scrollBlockedRef.current });
    
    if (shouldBlock) {
      // Start blocking - save position and freeze body
      console.log('[Student] 🔒 BLOCKING scroll now');
      savedScrollY.current = window.scrollY;
      scrollBlockedRef.current = true;
      
      // Apply blocking styles - include padding-top for the bar
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.paddingTop = '44px';
      document.documentElement.style.overflow = 'hidden';
      
    } else {
      // Stop blocking - restore position
      console.log('[Student] 🔓 ALLOWING scroll now');
      const scrollPos = savedScrollY.current;
      scrollBlockedRef.current = false;
      
      // Remove blocking styles but keep padding
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.style.paddingTop = '44px'; // Keep padding for top bar
      document.documentElement.style.overflow = '';
      
      // Restore scroll position after styles are removed
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPos);
      });
    }
    
  }, [isStudent, isControlled, canControl]);

  // Cleanup body styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.style.paddingTop = '';
      document.documentElement.style.overflow = '';
      scrollBlockedRef.current = false;
    };
  }, []);

  // Exit handler
  const handleExit = () => {
    // Cleanup styles
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    document.body.style.paddingTop = '';
    document.documentElement.style.overflow = '';
    scrollBlockedRef.current = false;
    
    if (currentSessionId.current) {
      FirebaseSync.leaveSession(currentSessionId.current, studentId.current);
    }
    setIsControlled(false);
    setCanControl(false);
    currentSessionId.current = null;
    isJoined.current = false;
    
    // Clear localStorage
    localStorage.removeItem('vivid-student-can-control');
  };

  // Don't render if not student or not controlled
  if (!isStudent || !isControlled) return null;

  // Use React portal to render at document body level
  return ReactDOM.createPortal(
    <div
      id="student-share-bar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '44px',
        backgroundColor: '#dc2626',
        zIndex: 2147483647, // Maximum possible z-index
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
      }}
    >
      {/* Live indicator */}
      <div style={{ position: 'relative', width: '10px', height: '10px' }}>
        <div style={{ 
          width: '10px', 
          height: '10px', 
          backgroundColor: 'white', 
          borderRadius: '50%' 
        }} />
        <div style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '10px', 
          height: '10px', 
          backgroundColor: 'white', 
          borderRadius: '50%',
          animation: 'studentPing 1s cubic-bezier(0, 0, 0.2, 1) infinite'
        }} />
      </div>
      
      <span style={{ fontWeight: 600 }}>{teacherName} sdílí</span>
      
      {/* Lock/Unlock indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '13px',
        backgroundColor: canControl ? '#16a34a' : '#991b1b'
      }}>
        {canControl ? <Unlock size={14} /> : <Lock size={14} />}
        <span>{canControl ? 'volný' : 'zamčeno'}</span>
      </div>
      
      {/* Exit button */}
      <button
        onClick={handleExit}
        style={{
          marginLeft: '8px',
          padding: '4px',
          borderRadius: '4px',
          border: 'none',
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
        title="Ukončit sledování (Esc)"
      >
        <X size={16} />
      </button>
      
      {/* Ping animation */}
      <style>{`
        @keyframes studentPing {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
