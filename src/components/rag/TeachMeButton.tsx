/**
 * TeachMeButton - Tlačítko "Nauč mě" pro spuštění AI tutoringu
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

interface TeachMeButtonProps {
  documentId?: string;
  documentTitle?: string;
  subject?: string;
  grade?: string;
  isActive?: boolean;
  status?: string;
  onClick?: () => void;
  variant?: 'default' | 'small' | 'icon';
  className?: string;
}

export function TeachMeButton({ 
  onClick,
  variant = 'default',
  className = ''
}: TeachMeButtonProps) {
  
  if (variant === 'icon') {
    return (
      <button
        onClick={onClick}
        className={`p-2 rounded-md hover:bg-accent transition-all ${className}`}
        style={{ color: '#4E5871' }}
        title="Nauč mě"
      >
        <Sparkles className="w-5 h-5" />
      </button>
    );
  }

  if (variant === 'small') {
    return (
      <button
        onClick={onClick}
        className={`flex p-2 rounded-md transition-all items-center gap-2 hover:bg-accent ${className}`}
        style={{ color: '#4E5871' }}
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Nauč mě</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex p-2 rounded-md transition-all items-center gap-2 hover:bg-accent ${className}`}
      style={{ color: '#4E5871' }}
      title="Nauč mě"
    >
      <Sparkles className="h-5 w-5" />
      <span className="font-medium">Nauč mě</span>
    </button>
  );
}

/**
 * Floating action button varianta
 */
export function TeachMeFAB({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50 ${className}`}
      title="Spustit AI tutoring"
    >
      <Sparkles className="w-6 h-6" />
    </button>
  );
}