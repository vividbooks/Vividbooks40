/**
 * GeneratingLoader - Animovaný loading s velkými rotujícími kontextovými hláškami
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

interface GeneratingLoaderProps {
  messages: string[];
  title?: string;
  intervalMs?: number;
  onCancel?: () => void;
}

export function GeneratingLoader({ 
  messages, 
  title = 'Generuji obsah',
  intervalMs = 3000,
  onCancel,
}: GeneratingLoaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const currentMessage = messages[currentIndex] || 'Pracuji na tom...';

  // Typewriter effect
  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (charIndex < currentMessage.length) {
        setDisplayedText(currentMessage.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [currentMessage]);

  // Rotate messages
  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % messages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [messages.length, intervalMs]);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
      }}
    >
      {/* Cancel button - top right corner */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-3 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 transition-colors shadow-lg"
          title="Zrušit"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Background gradient blobs - more visible */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full animate-pulse" 
          style={{ 
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-0 right-0 w-[700px] h-[700px] rounded-full animate-pulse" 
          style={{ 
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 60%)',
            filter: 'blur(100px)',
            animationDelay: '1s',
          }}
        />
        <div 
          className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full animate-pulse" 
          style={{ 
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 60%)',
            filter: 'blur(60px)',
            animationDelay: '0.5s',
          }}
        />
        <div 
          className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] rounded-full animate-pulse" 
          style={{ 
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.12) 0%, transparent 60%)',
            filter: 'blur(70px)',
            animationDelay: '1.5s',
          }}
        />
      </div>

      {/* Content - stacked vertically */}
      <div className="flex flex-col items-center justify-center">
        {/* Small icon */}
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl opacity-90 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Small title */}
        <p className="text-slate-500 text-sm font-medium tracking-wider uppercase mb-8">
          {title}
        </p>

        {/* LARGE rotating message with typewriter effect */}
        <div className="min-h-[160px] flex items-center justify-center px-8 max-w-6xl">
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-center text-slate-700"
          >
            {displayedText}
            {isTyping && <span className="animate-pulse text-slate-400">|</span>}
          </h1>
        </div>

        {/* Small progress dots */}
        <div className="mt-12 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      {/* Tiny tip at bottom */}
      <p className="absolute bottom-6 text-slate-400/60 text-xs">
        AI analyzuje obsah a vytváří materiál na míru
      </p>
    </div>
  );
}

