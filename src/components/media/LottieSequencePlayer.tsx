import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { Play, Pause, RotateCw, Ban, Maximize2, Minimize2, X } from 'lucide-react';
import { LottieStep } from '../../types/section-media';
import { useViewMode } from '../../contexts/ViewModeContext';
import * as FirebaseSync from '../../utils/classroom-firebase';

interface LottieSequencePlayerProps {
  introUrl?: string;
  steps: LottieStep[];
  shouldLoop: boolean;
  autoplay?: boolean;
  animationId?: string; // Unique ID for sync (defaults to first step URL)
  backgroundImage?: string; // Background image URL (for transparent Lottie animations)
}

export function LottieSequencePlayer({ 
  introUrl, 
  steps, 
  shouldLoop: initialShouldLoop,
  autoplay = true,
  animationId: propAnimationId,
  backgroundImage
}: LottieSequencePlayerProps) {
  // View mode (teacher/student)
  const { isStudent, isTeacher } = useViewMode();
  
  // Generate unique animation ID
  const animationId = propAnimationId || steps[0]?.url || `anim-${Date.now()}`;
  
  // State - no autoplay by default, click to play
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); // Never autoplay
  const [isLooping, setIsLooping] = useState(initialShouldLoop);
  const [showIntro, setShowIntro] = useState(!!introUrl);
  const [animationData, setAnimationData] = useState<any>(null);
  const [introData, setIntroData] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // Prevent infinite loops
  const [studentCanControl, setStudentCanControl] = useState(true); // Can student interact?
  
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const sessionIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false); // Track if we've loaded the first animation
  
  // Check student control permission
  // Works for both student mode AND when student has joined a sharing session
  useEffect(() => {
    // Function to check control state
    const checkControlState = () => {
      // If teacher, always allow
      if (isTeacher) return true;
      
      // Check localStorage for sharing session control state
      const controlValue = localStorage.getItem('vivid-student-can-control');
      
      // If no value set (no active session), allow control
      if (controlValue === null) return true;
      
      // Only 'false' blocks control
      return controlValue !== 'false';
    };
    
    // Initial check
    const initialValue = checkControlState();
    console.log('[Animation] Initial control check:', { isTeacher, isStudent, canControl: initialValue });
    setStudentCanControl(initialValue);
    
    // Listen for control changes from FirebaseStudentView
    const handleControlChange = (e: CustomEvent<{ canControl: boolean }>) => {
      console.log('[Animation] Control event received:', e.detail.canControl);
      setStudentCanControl(e.detail.canControl);
    };
    
    window.addEventListener('studentControlChanged', handleControlChange as EventListener);
    
    // Poll as backup (for when localStorage changes without event)
    let lastPolledValue = initialValue;
    const interval = setInterval(() => {
      const newVal = checkControlState();
      if (lastPolledValue !== newVal) {
        console.log('[Animation] Control changed via polling:', lastPolledValue, '->', newVal);
        lastPolledValue = newVal;
        setStudentCanControl(newVal);
      }
    }, 200); // Check more frequently
    
    return () => {
      window.removeEventListener('studentControlChanged', handleControlChange as EventListener);
      clearInterval(interval);
    };
  }, [isTeacher, isStudent]);
  
  // Get active session ID from localStorage
  useEffect(() => {
    const checkSession = () => {
      const sessionData = localStorage.getItem('vivid-active-session-id');
      sessionIdRef.current = sessionData;
    };
    checkSession();
    
    // Check periodically for session changes
    const interval = setInterval(checkSession, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Broadcast animation state changes (teacher only)
  const broadcastAnimationState = useCallback((step: number, playing: boolean) => {
    if (!isTeacher || !sessionIdRef.current || isSyncing) return;
    
    FirebaseSync.updateAnimationState(
      sessionIdRef.current,
      animationId,
      step,
      playing
    ).catch(err => console.error('Failed to broadcast animation state:', err));
  }, [isTeacher, animationId, isSyncing]);
  
  // Listen for animation state changes (student only)
  useEffect(() => {
    if (!isStudent) return;
    
    const unsubscribe = FirebaseSync.subscribeToActiveSessions((session) => {
      if (!session?.animationState) return;
      
      const { animationId: syncAnimId, currentStep, isPlaying: syncPlaying } = session.animationState;
      
      // Only apply if this animation matches
      if (syncAnimId !== animationId) return;
      
      console.log('[Animation] Syncing from teacher:', currentStep, syncPlaying);
      
      setIsSyncing(true);
      
      // Apply state
      if (currentStep !== currentStepIndex) {
        setShowIntro(false);
        setCurrentStepIndex(currentStep);
      }
      
      if (syncPlaying !== isPlaying) {
        setIsPlaying(syncPlaying);
        if (syncPlaying) {
          lottieRef.current?.play();
        } else {
          lottieRef.current?.pause();
        }
      }
      
      // Reset syncing flag after a short delay
      setTimeout(() => setIsSyncing(false), 100);
    });
    
    return () => unsubscribe();
  }, [isStudent, animationId, currentStepIndex, isPlaying]);

  // Animation cache to avoid re-fetching
  const animCacheRef = useRef<Map<string, any>>(new Map());
  
  // Load animation data with caching - runs IMMEDIATELY
  useEffect(() => {
    const loadAnim = async () => {
      const currentUrl = steps[currentStepIndex]?.url;
      console.log('[Animation] Loading animation...', { 
        showIntro, 
        introUrl, 
        currentStepIndex, 
        currentUrl,
        stepsCount: steps.length,
        hasLoaded: hasLoadedRef.current
      });
      
      try {
        if (showIntro && introUrl) {
          // Load intro
          if (!introData) {
            if (animCacheRef.current.has(introUrl)) {
              console.log('[Animation] Using cached intro');
              setIntroData(animCacheRef.current.get(introUrl));
            } else {
              console.log('[Animation] Fetching intro:', introUrl);
              const response = await fetch(introUrl);
              const data = await response.json();
              animCacheRef.current.set(introUrl, data);
              setIntroData(data);
              hasLoadedRef.current = true;
            }
          }
        } else if (currentUrl) {
          // Load main animation
          if (animCacheRef.current.has(currentUrl)) {
            console.log('[Animation] Using cached animation');
            setAnimationData(animCacheRef.current.get(currentUrl));
            hasLoadedRef.current = true;
          } else {
            console.log('[Animation] Fetching animation:', currentUrl);
            const response = await fetch(currentUrl);
            const data = await response.json();
            animCacheRef.current.set(currentUrl, data);
            setAnimationData(data);
            hasLoadedRef.current = true;
            console.log('[Animation] Animation loaded successfully');
          }
        } else {
          console.log('[Animation] No URL to load - steps:', steps);
        }
      } catch (error) {
        console.error("[Animation] Failed to load animation:", error);
      }
    };

    // Load immediately - don't wait for anything
    loadAnim();
  }, [currentStepIndex, steps, showIntro, introUrl, introData]);
  
  // Preload first animation immediately on mount, then preload rest
  useEffect(() => {
    const loadFirst = async () => {
      // Immediately load the first animation (don't wait)
      const firstUrl = steps[0]?.url;
      if (firstUrl && !animCacheRef.current.has(firstUrl)) {
        try {
          console.log('[Animation] Preloading first step immediately');
          const response = await fetch(firstUrl);
          const data = await response.json();
          animCacheRef.current.set(firstUrl, data);
          // If we're on step 0 and no animation data yet, set it
          if (currentStepIndex === 0 && !animationData) {
            setAnimationData(data);
          }
        } catch (e) {
          console.error('[Animation] Failed to preload first step:', e);
        }
      }
    };
    
    // Load first step immediately
    loadFirst();
    
    // Preload rest in background
    const preloadRest = async () => {
      // Preload intro
      if (introUrl && !animCacheRef.current.has(introUrl)) {
        try {
          const response = await fetch(introUrl);
          const data = await response.json();
          animCacheRef.current.set(introUrl, data);
        } catch (e) {}
      }
      
      // Preload remaining steps
      for (let i = 1; i < steps.length; i++) {
        const step = steps[i];
        if (step.url && !animCacheRef.current.has(step.url)) {
          try {
            const response = await fetch(step.url);
            const data = await response.json();
            animCacheRef.current.set(step.url, data);
          } catch (e) {}
        }
      }
    };
    
    // Start preloading rest after a short delay
    const timer = setTimeout(preloadRest, 500);
    return () => clearTimeout(timer);
  }, [introUrl, steps, currentStepIndex, animationData]);

  // Handle Escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Control Lottie animation based on isPlaying state
  useEffect(() => {
    if (!lottieRef.current) return;
    
    if (isPlaying) {
      lottieRef.current.play();
    } else {
      lottieRef.current.pause();
    }
  }, [isPlaying, animationData]); // Re-run when animation data changes too

  // Handlers
  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleStepClick = (index: number) => {
    // Check control directly from localStorage for most up-to-date value
    const currentControlValue = localStorage.getItem('vivid-student-can-control');
    const canControlNow = isTeacher || currentControlValue !== 'false';
    
    // Block if student cannot control (but teacher always can)
    if (!canControlNow) {
      console.log('[Animation] Step click blocked - localStorage:', currentControlValue);
      return;
    }
    
    setShowIntro(false); // Skip intro if navigating
    setCurrentStepIndex(index);
    setIsPlaying(true);
    
    // Broadcast to students
    broadcastAnimationState(index, true);
  };

  const togglePlay = () => {
    // Check control directly from localStorage for most up-to-date value
    const currentControlValue = localStorage.getItem('vivid-student-can-control');
    const canControlNow = isTeacher || currentControlValue !== 'false';
    
    console.log('[Animation] Toggle play check:', { 
      isTeacher, 
      studentCanControl, 
      localStorage: currentControlValue,
      canControlNow 
    });
    
    // Block if student cannot control (but teacher always can)
    if (!canControlNow) {
      console.log('[Animation] Toggle play BLOCKED');
      return;
    }
    console.log('[Animation] Toggle play ALLOWED');
    
    const newPlaying = !isPlaying;
    
    if (newPlaying) {
      lottieRef.current?.play();
    } else {
      lottieRef.current?.pause();
    }
    setIsPlaying(newPlaying);
    
    // Broadcast to students
    broadcastAnimationState(currentStepIndex, newPlaying);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const playerContent = (
    <div 
      className={`
        bg-white text-slate-900 transition-all duration-300
        ${isFullscreen 
          ? 'fixed inset-0 z-[9999] flex w-screen h-screen rounded-none' 
          : 'relative flex w-full rounded-lg border border-gray-200 overflow-hidden shadow-sm'
        }
      `}
    >
      {/* Side Navigation & Controls Sidebar */}
      {(steps.length > 1 || isFullscreen) && (
        <div className={`w-16 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-4 shrink-0 z-10 ${isFullscreen ? 'h-full overflow-hidden' : 'overflow-y-auto custom-scrollbar gap-4'}`}>
          {isFullscreen ? (
            <div className="flex flex-col items-center w-full h-full">
              {/* Top Spacer to center content */}
              <div className="flex-1" />

              {/* Centered Content Group */}
              <div className="flex flex-col items-center gap-4 shrink-0 w-full px-1">
                {/* Steps */}
                {steps.length > 1 && (
                  <div className="flex flex-col items-center gap-4 w-full overflow-y-auto custom-scrollbar max-h-[40vh] py-2">
                    {steps.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleStepClick(index)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 shrink-0 ${
                          !showIntro && currentStepIndex === index
                            ? 'bg-primary text-primary-foreground scale-110 ring-2 ring-primary/30'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                        aria-label={`Go to animation step ${index + 1}`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Divider */}
                {steps.length > 1 && <div className="w-8 h-px bg-gray-300 shrink-0" />}
                
                {/* Controls */}
                <div className="flex flex-col items-center gap-4 shrink-0">
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-100 flex items-center justify-center text-slate-700 hover:text-primary transition-all"
                    title={isPlaying ? "Pozastavit" : "Přehrát"}
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                  </button>
                  
                  <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`w-10 h-10 rounded-full border shadow-sm flex items-center justify-center transition-all ${
                      isLooping 
                        ? 'bg-primary/10 border-primary/20 text-primary' 
                        : 'bg-white border-gray-200 text-slate-400 hover:bg-gray-100 hover:text-slate-700'
                    }`}
                    title={isLooping ? "Vypnout smyčku" : "Zapnout smyčku"}
                  >
                    {isLooping ? <RotateCw size={18} /> : <Ban size={18} />}
                  </button>
                </div>
              </div>

              {/* Bottom Spacer to center content */}
              <div className="flex-1" />

              {/* Exit Button (Always at bottom) */}
              <div className="shrink-0 mt-4">
                <button
                  onClick={toggleFullscreen}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-all"
                  title="Ukončit celou obrazovku"
                >
                  <Minimize2 size={20} />
                </button>
              </div>
            </div>
          ) : (
            /* Normal Mode - Steps at top */
            steps.length > 1 && steps.map((_, index) => (
              <button
                key={index}
                onClick={() => handleStepClick(index)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 shrink-0 ${
                  !showIntro && currentStepIndex === index
                    ? 'bg-primary text-primary-foreground scale-110 ring-2 ring-primary/30'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
                aria-label={`Go to animation step ${index + 1}`}
              >
                {index + 1}
              </button>
            ))
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative min-w-0">
        <div 
          className={`relative w-full ${backgroundImage ? 'bg-transparent' : 'bg-white'} flex items-center justify-center group ${isFullscreen ? 'h-full' : 'aspect-square'} ${
            !studentCanControl ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={togglePlay}
          title={!studentCanControl ? "Učitel ovládá animaci" : (isPlaying ? "Klikni pro pozastavení" : "Klikni pro přehrání")}
        >
          {/* Background image for transparent Lottie animations */}
          {backgroundImage && (
            <img 
              src={backgroundImage} 
              alt="" 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ zIndex: 0 }}
            />
          )}
          
          {showIntro && introData ? (
            <Lottie
              lottieRef={lottieRef}
              animationData={introData}
              loop={false}
              autoplay={false}
              onComplete={handleIntroComplete}
              className="w-full h-full max-h-full object-contain relative z-10"
            />
          ) : animationData ? (
            <>
              <Lottie
                lottieRef={lottieRef}
                animationData={animationData}
                loop={isLooping}
                autoplay={false}
                className="w-full h-full max-h-full object-contain relative z-10"
              />
              {/* Play overlay when paused - always show */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center border border-slate-200">
                    <Play size={36} className="text-slate-700 ml-1" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-slate-100 animate-pulse">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                  <Play size={32} className="text-slate-300 ml-1" />
                </div>
                <span className="text-sm">Načítání animace...</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls Bar (Visible only in Normal Mode) */}
        {!isFullscreen && (
          <div className="h-12 border-t border-gray-200 bg-white flex items-center px-4 justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-md hover:bg-gray-100 text-slate-700 hover:text-primary transition-colors"
                title={isPlaying ? "Pozastavit" : "Přehrát"}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-1.5 rounded-md transition-colors ${
                  isLooping 
                    ? 'text-primary bg-primary/10' 
                    : 'text-slate-400 hover:bg-gray-100 hover:text-slate-700'
                }`}
                title={isLooping ? "Vypnout smyčku" : "Zapnout smyčku"}
              >
                {isLooping ? <RotateCw size={16} /> : <Ban size={16} />}
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Show "teacher controls" message when control is disabled */}
              {!studentCanControl ? (
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Učitel ovládá animaci
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-medium">
                  {showIntro ? 'Intro' : `Krok ${currentStepIndex + 1} / ${steps.length}`}
                </div>
              )}

              <div className="w-px h-4 bg-gray-200" />

              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-md hover:bg-gray-100 text-slate-700 hover:text-primary transition-colors"
                title="Celá obrazovka"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        {/* Placeholder to prevent layout shift */}
        <div className="w-full aspect-video bg-transparent invisible" />
        {createPortal(playerContent, document.body)}
      </>
    );
  }

  return playerContent;
}
