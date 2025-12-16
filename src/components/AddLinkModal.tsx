/**
 * AddLinkModal - Modal pro přidání odkazu
 */

import { useState, useEffect } from 'react';
import { X, Link, ExternalLink, Loader2, Globe, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { detectLinkType, isValidUrl, extractLinkTitle, SUPPORTED_SERVICES, LinkInfo } from '../utils/link-detector';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, title: string, linkInfo: LinkInfo) => void;
  currentFolderId?: string | null;
}

// Dynamické ikony pro různé typy odkazů
const LinkIcon = ({ type, className }: { type: string; className?: string }) => {
  // Pro většinu typů použijeme Globe nebo Link
  return <Globe className={className} />;
};

export function AddLinkModal({ isOpen, onClose, onAdd, currentFolderId }: AddLinkModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServices, setShowServices] = useState(false);

  // Detect link type when URL changes
  useEffect(() => {
    if (url.trim()) {
      // Přidej https:// pokud chybí protokol
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//)) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      if (isValidUrl(normalizedUrl)) {
        setIsValidating(true);
        setError(null);
        
        // Simulace validace (můžeme přidat fetch pro metadata)
        const timer = setTimeout(() => {
          const info = detectLinkType(normalizedUrl);
          setLinkInfo(info);
          
          // Auto-fill title if empty
          if (!title.trim()) {
            setTitle(extractLinkTitle(normalizedUrl));
          }
          
          setIsValidating(false);
        }, 300);
        
        return () => clearTimeout(timer);
      } else {
        setLinkInfo(null);
        setError('Neplatná URL adresa');
      }
    } else {
      setLinkInfo(null);
      setError(null);
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Zadejte URL adresu');
      return;
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    if (!isValidUrl(normalizedUrl)) {
      setError('Neplatná URL adresa');
      return;
    }

    const info = linkInfo || detectLinkType(normalizedUrl);
    const finalTitle = title.trim() || extractLinkTitle(normalizedUrl);
    
    onAdd(normalizedUrl, finalTitle, info);
    
    // Reset form
    setUrl('');
    setTitle('');
    setLinkInfo(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Link className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Přidat odkaz</h2>
              <p className="text-sm text-slate-500">Uložte si odkaz jako soubor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">URL adresa *</label>
            <div className="relative">
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="pr-10"
                autoFocus
              />
              {isValidating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
              {linkInfo && !isValidating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          {/* Link Preview */}
          {linkInfo && (
            <div className={`p-4 rounded-xl border-2 ${linkInfo.bgColor} border-slate-200`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl bg-white shadow-sm ${linkInfo.color}`}>
                  <Globe className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{linkInfo.name}</p>
                  <p className="text-sm text-slate-500 truncate">{linkInfo.domain}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" />
              </div>
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Název (volitelné)</label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Automaticky vyplněno z URL"
            />
            <p className="text-xs text-slate-500">Pokud necháte prázdné, použije se název z odkazu</p>
          </div>

          {/* Supported Services */}
          <div>
            <button
              type="button"
              onClick={() => setShowServices(!showServices)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showServices ? '▼' : '▶'} Podporované služby ({SUPPORTED_SERVICES.reduce((sum, cat) => sum + cat.services.length, 0)}+)
            </button>
            
            {showServices && (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {SUPPORTED_SERVICES.map((category) => (
                    <div key={category.category}>
                      <p className="font-medium text-slate-700 mb-1">{category.category}</p>
                      <ul className="text-slate-500 space-y-0.5">
                        {category.services.map((service) => (
                          <li key={service} className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {service}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Zrušit
            </Button>
            <Button
              type="submit"
              disabled={!url.trim() || !!error || isValidating}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
            >
              <Link className="h-4 w-4 mr-2" />
              Přidat odkaz
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}






