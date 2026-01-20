/**
 * LinkPreviewModal - Modal pro náhled odkazu s akcemi
 */

import { useState } from 'react';
import { X, ExternalLink, FileEdit, Play, Link2, Copy, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { StoredLink } from '../types/file-storage';
import { getYouTubeTranscript } from '../utils/youtube-transcript';

interface LinkPreviewModalProps {
  link: StoredLink;
  onClose: () => void;
  onCreateWorksheet: (link: StoredLink) => void;
  onCreateQuiz: (link: StoredLink) => void;
}

// Extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract Loom video ID
function getLoomVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('loom.com')) {
      const match = urlObj.pathname.match(/\/share\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract Vimeo video ID
function getVimeoVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('vimeo.com')) {
      const match = urlObj.pathname.match(/\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function LinkPreviewModal({ link, onClose, onCreateWorksheet, onCreateQuiz }: LinkPreviewModalProps) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const youtubeId = getYouTubeVideoId(link.url);
  const loomId = getLoomVideoId(link.url);
  const vimeoId = getVimeoVideoId(link.url);

  const canEmbed = youtubeId || loomId || vimeoId;
  const hasTranscript = link.linkType === 'youtube' || link.linkType === 'loom';

  const handleLoadTranscript = async () => {
    if (transcript) {
      // Already loaded, just toggle visibility
      setShowTranscript(!showTranscript);
      return;
    }

    // Zkontrolovat jestli už máme transcript uložený v linku
    if (link.extractedText) {
      console.log('[LinkPreview] Using cached transcript, length:', link.extractedText.length);
      setTranscript(link.extractedText);
      setShowTranscript(true);
      return;
    }

    // Pokud nemáme uložený transcript, stáhneme ho
    setIsLoadingTranscript(true);
    setTranscriptError(null);
    setShowTranscript(true);

    try {
      if (link.linkType === 'youtube') {
        const result = await getYouTubeTranscript(link.url);
        if (result.success && result.transcript) {
          setTranscript(result.transcript);
        } else {
          setTranscriptError(result.error || 'Nepodařilo se načíst transcript');
        }
      } else if (link.linkType === 'loom') {
        setTranscriptError('Extrakce transkriptu z Loom není momentálně podporována');
      }
    } catch (err) {
      setTranscriptError('Chyba při načítání transkriptu');
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(link.url);
  };

  const handleOpenExternal = () => {
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      {/* Modal - fixed size 1000x700 */}
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: '1000px', height: '700px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${link.bgColor}`}>
              <Link2 className={`h-5 w-5 ${link.color}`} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800 truncate">{link.title}</h2>
              <p className="text-sm text-slate-500 truncate">{link.domain}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                }}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                Akce – vytvořit
              </button>

              {isActionsOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      onCreateWorksheet(link);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3"
                  >
                    <FileEdit className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="font-medium text-slate-700">Pracovní list</p>
                      <p className="text-xs text-slate-500">Vytvořit cvičení z obsahu</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      onCreateQuiz(link);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3"
                  >
                    <Play className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="font-medium text-slate-700">Kvíz</p>
                      <p className="text-xs text-slate-500">Interaktivní test pro žáky</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Copy URL */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Kopírovat
            </Button>

            {/* Open External */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenExternal}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Otevřít
            </Button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-100 relative min-h-0 flex items-center justify-center p-4">
          {/* YouTube Embed */}
          {youtubeId && (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              className="w-full h-full rounded-lg shadow-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          {/* Loom Embed */}
          {loomId && (
            <iframe
              src={`https://www.loom.com/embed/${loomId}`}
              className="w-full h-full rounded-lg shadow-lg"
              allowFullScreen
            />
          )}

          {/* Vimeo Embed */}
          {vimeoId && (
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}`}
              className="w-full h-full rounded-lg shadow-lg"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )}

          {/* Fallback for non-embeddable links */}
          {!canEmbed && (
            <div className="text-center">
              {link.thumbnailUrl ? (
                <img 
                  src={link.thumbnailUrl} 
                  alt={link.title}
                  className="max-w-lg max-h-80 rounded-xl shadow-lg mx-auto mb-6"
                />
              ) : (
                <div className={`p-8 rounded-2xl ${link.bgColor} mb-6 inline-block`}>
                  <Link2 className={`h-16 w-16 ${link.color}`} />
                </div>
              )}
              <h3 className="text-xl font-semibold text-slate-700 mb-2">{link.title}</h3>
              <p className="text-slate-500 mb-4">{link.url}</p>
              <Button onClick={handleOpenExternal} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Otevřít v novém okně
              </Button>
            </div>
          )}
        </div>

        {/* Footer with transcript */}
        {hasTranscript && (
          <div className="border-t border-slate-200 bg-white shrink-0">
            {/* Transcript toggle button */}
            <button
              onClick={handleLoadTranscript}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-green-600 font-medium">
                <Sparkles className="h-4 w-4" />
                {link.extractedText ? 'Transcript připraven' : 'Transcript dostupný pro AI'}
                {link.extractedText && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    ✓ Uloženo
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2 text-slate-400">
                {isLoadingTranscript ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : showTranscript ? (
                  <>
                    <span className="text-sm">Skrýt</span>
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span className="text-sm">Zobrazit</span>
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </span>
            </button>

            {/* Transcript content */}
            {showTranscript && (
              <div className="px-4 pb-4 max-h-48 overflow-y-auto">
                {isLoadingTranscript ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-green-500 mr-3" />
                    <span className="text-slate-500">Načítám transcript z videa...</span>
                  </div>
                ) : transcriptError ? (
                  <div className="bg-red-50 text-red-600 rounded-lg p-4 text-sm">
                    {transcriptError}
                  </div>
                ) : transcript ? (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {transcript}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

