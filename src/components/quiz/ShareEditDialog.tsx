/**
 * Share Edit Dialog
 * 
 * Dialog for sharing a board with two modes:
 * 1. Login link - users can copy the board to their account
 * 2. Public link - anonymous users can view and comment on slides
 */

import React, { useState } from 'react';
import {
  X,
  Copy,
  CheckCircle,
  Link,
  Users,
  MessageSquare,
  ExternalLink,
  LogIn,
  Loader2,
} from 'lucide-react';
import { setBoardPublic } from '../../utils/quiz-storage';

interface ShareEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardTitle: string;
}

type ShareMode = 'login' | 'public';

export function ShareEditDialog({ isOpen, onClose, boardId, boardTitle }: ShareEditDialogProps) {
  const [selectedMode, setSelectedMode] = useState<ShareMode>('public');
  const [copied, setCopied] = useState(false);
  const [isSettingPublic, setIsSettingPublic] = useState(false);

  if (!isOpen) return null;

  const baseUrl = window.location.origin + (import.meta.env.BASE_URL || '/');
  
  const getShareUrl = () => {
    if (selectedMode === 'login') {
      return `${baseUrl}quiz/copy/${boardId}`;
    } else {
      return `${baseUrl}quiz/public/${boardId}`;
    }
  };

  const copyToClipboard = async () => {
    try {
      // If public mode, mark the board as public first
      if (selectedMode === 'public') {
        setIsSettingPublic(true);
        const success = await setBoardPublic(boardId, true);
        setIsSettingPublic(false);
        if (!success) {
          console.warn('Failed to set board as public, but continuing with copy');
        }
      }
      
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
      setIsSettingPublic(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-800">Sdílet odkaz pro úpravu</h2>
            <p className="text-xs text-slate-500 mt-0.5">{boardTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-2">
            {/* Login Link Option */}
            <button
              onClick={() => setSelectedMode('login')}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                selectedMode === 'login'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                selectedMode === 'login' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <LogIn className="w-4 h-4" />
              </div>
              <h3 className={`text-sm font-semibold mb-0.5 ${
                selectedMode === 'login' ? 'text-indigo-700' : 'text-slate-700'
              }`}>
                Odkaz pro přihlášení
              </h3>
              <p className="text-[11px] text-slate-500 leading-tight">
                Uživatelé si mohou board zkopírovat k sobě a upravit
              </p>
            </button>

            {/* Public Link Option */}
            <button
              onClick={() => setSelectedMode('public')}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                selectedMode === 'public'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                selectedMode === 'public' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className={`text-sm font-semibold mb-0.5 ${
                selectedMode === 'public' ? 'text-indigo-700' : 'text-slate-700'
              }`}>
                Veřejný odkaz
              </h3>
              <p className="text-[11px] text-slate-500 leading-tight">
                Kdokoliv může prohlížet a přidávat komentáře
              </p>
            </button>
          </div>

          {/* Selected Mode Details */}
          <div className="bg-slate-50 rounded-lg p-3">
            {selectedMode === 'login' ? (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-700 font-medium">
                    Uživatelé musí být přihlášení
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Board se zkopíruje do jejich obsahu. Původní zůstane beze změny.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-700 font-medium">
                    Komentáře od veřejnosti
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Návštěvníci mohou přidávat komentáře. Uvidíte je v editoru.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* URL Display & Copy */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-100 rounded-lg">
              <Link className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-600 truncate font-mono">
                {getShareUrl()}
              </span>
            </div>
            <button
              onClick={copyToClipboard}
              className={`px-3 py-2.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Zkopírováno
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Kopírovat
                </>
              )}
            </button>
          </div>

          {/* Open in new tab */}
          <a
            href={getShareUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 py-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Otevřít v novém okně
          </a>
        </div>
      </div>
    </div>
  );
}

export default ShareEditDialog;
