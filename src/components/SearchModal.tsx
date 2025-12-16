import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, X, Lock } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { storage } from '../utils/profile-storage';
import { Subject, isLicenseActive } from '../types/profile';

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category?: string;
  // Added for license filtering
  isInFolder?: boolean;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType?: 'library' | 'my-content';
}

// Map category to subject ID
function mapCategoryToSubject(category: string): Subject | null {
  const categoryMap: Record<string, Subject> = {
    'fyzika': 'fyzika',
    'chemie': 'chemie',
    'prirodopis': 'prirodopis',
    'matematika': 'matematika-2',
    'matematika-1': 'matematika-1',
    'matematika-2': 'matematika-2',
    'prvouka': 'prvouka',
  };
  return categoryMap[category?.toLowerCase()] || null;
}

// Check if user can view this result based on license
function canViewResult(result: SearchResult): { canView: boolean; hasBasicOnly: boolean } {
  const profile = storage.getCurrentUserProfile();
  
  // No profile = allow all (development mode)
  if (!profile || !profile.schoolId) {
    return { canView: true, hasBasicOnly: false };
  }
  
  const license = storage.getLicenseBySchoolId(profile.schoolId);
  if (!license) {
    return { canView: true, hasBasicOnly: false };
  }
  
  const subjectId = mapCategoryToSubject(result.category || '');
  if (!subjectId) {
    return { canView: true, hasBasicOnly: false };
  }
  
  const subjectLicense = license.subjects.find(l => l.subject === subjectId);
  if (!subjectLicense || !isLicenseActive(subjectLicense)) {
    return { canView: false, hasBasicOnly: false };
  }
  
  // User has basic access (workbooks) - can't view folder content
  const hasBasicOnly = subjectLicense.tier === 'workbooks';
  
  // Check if result is from a folder (has nested path structure suggesting folder)
  // Workbook content usually has paths like: "workbook-name/page-name"
  // Folder content might have paths like: "folder/subfolder/page"
  const slugParts = result.slug?.split('/') || [];
  const isLikelyFolderContent = slugParts.length > 2; // More than 2 levels deep suggests folder structure
  
  if (hasBasicOnly && isLikelyFolderContent) {
    return { canView: false, hasBasicOnly: true };
  }
  
  return { canView: true, hasBasicOnly };
}

export function SearchModal({ isOpen, onClose, contentType = 'library' }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Filter results based on license
  const filteredResults = useMemo(() => {
    return results.map(result => ({
      ...result,
      accessInfo: canViewResult(result)
    }));
  }, [results]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length > 1) {
      const debounce = setTimeout(() => {
        performSearch(query);
      }, 300);

      return () => clearTimeout(debounce);
    } else {
      setResults([]);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const navigateToResult = (result: SearchResult) => {
    const category = result.category || 'knihovna-vividbooks';
    navigate(`/docs/${category}/${result.slug}`);
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {text.substring(index, index + query.length)}
        </mark>
        {text.substring(index + query.length)}
      </>
    );
  };

  const getExcerpt = (content: string, query: string, maxLength: number = 150) => {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 100);
    const excerpt = content.substring(start, end);

    return (start > 0 ? '...' : '') + excerpt + (end < content.length ? '...' : '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-4 md:pt-20 px-4">
      <div 
        className="w-full max-w-2xl bg-background border border-border rounded-lg shadow-2xl max-h-[90vh] md:max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-b border-border shrink-0">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contentType === 'my-content' ? "Hledat v mém obsahu..." : "Hledat v knihovně..."}
            className="flex-1 bg-transparent outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-accent rounded"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded"
          >
            <kbd className="px-2 py-1 text-xs border border-border rounded">ESC</kbd>
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoadingSpinner size="sm" className="p-8" />
          ) : filteredResults.length > 0 ? (
            <div className="py-2">
              {filteredResults.map((result, index) => {
                const isAccessible = result.accessInfo.canView;
                const hasBasicOnly = result.accessInfo.hasBasicOnly;
                
                return (
                <button
                  key={result.id}
                    onClick={() => isAccessible ? navigateToResult(result) : null}
                    disabled={!isAccessible}
                  className={`
                    w-full text-left px-4 py-3 flex items-start gap-3
                    transition-colors
                      ${!isAccessible ? 'opacity-50 cursor-not-allowed' : ''}
                      ${isAccessible && index === selectedIndex ? 'bg-accent' : isAccessible ? 'hover:bg-accent/50' : ''}
                  `}
                    onMouseEnter={() => isAccessible && setSelectedIndex(index)}
                    title={!isAccessible ? (hasBasicOnly ? 'Vyžaduje Rozšířený digitální přístup' : 'Nemáte licenci k tomuto předmětu') : undefined}
                >
                    {isAccessible ? (
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    ) : (
                      <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    )}
                  <div className="flex-1 min-w-0">
                      <div className="font-medium mb-1 flex items-center gap-2">
                      {highlightMatch(result.title, query)}
                        {!isAccessible && (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            {hasBasicOnly ? 'Rozšířený přístup' : 'Bez licence'}
                          </span>
                        )}
                    </div>
                    {result.description && (
                      <div className="text-sm text-muted-foreground mb-1">
                        {highlightMatch(result.description, query)}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {getExcerpt(result.content, query)}
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          ) : query.length > 1 ? (
            <div className="p-8 text-center text-muted-foreground">
              Žádné výsledky pro "{query}"
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Začněte psát pro vyhledávání...
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredResults.length > 0 && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 border border-border rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 border border-border rounded">↓</kbd>
                <span>to navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 border border-border rounded">Enter</kbd>
                <span>to select</span>
              </div>
            </div>
            <div>
              {filteredResults.filter(r => r.accessInfo.canView).length} dostupných / {filteredResults.length} výsledků
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      <div 
        className="fixed inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}
