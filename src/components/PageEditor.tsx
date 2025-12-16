import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Save, ArrowLeft, Eye, Moon, Sun, Settings, Check } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { HtmlRenderer } from './HtmlRenderer';
import { CategoryManager } from './CategoryManager';
import { LoadingSpinner } from './LoadingSpinner';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { DOCUMENT_TYPES } from '../types/document-types';

interface PageEditorProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

interface Category {
  id: string;
  label: string;
}

export function PageEditor({ theme, toggleTheme }: PageEditorProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditMode = !!slug;

  const [title, setTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState('lesson');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [category, setCategory] = useState('knihovna-vividbooks');
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  useEffect(() => {
    loadCategories();
    if (isEditMode && slug) {
      loadPage(slug);
    }
  }, [slug]);

  const loadCategories = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      // Use default categories on error
      setCategories([
        { id: 'knihovna-vividbooks', label: 'Knihovna Vividbooks' },
        { id: 'vividboard', label: 'Vividboard' },
        { id: 'metodika', label: 'Metodika' }
      ]);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    // Skip auto-save on initial load
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    if (!isEditMode) return; // Only auto-save in edit mode
    if (!title || !pageSlug) return; // Don't auto-save invalid pages
    
    setAutoSaveStatus('unsaved');
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, description, category, pageSlug, documentType, externalUrl]);

  const loadPage = async (pageSlug: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${pageSlug}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const page = data.page;
        setTitle(page.title);
        setPageSlug(page.slug);
        setDescription(page.description || '');
        setDocumentType(page.documentType || 'lesson');
        setContent(page.content || '');
        setExternalUrl(page.externalUrl || '');
        setCategory(page.category || 'knihovna-vividbooks');
      } else {
        setError('Page not found');
      }
    } catch (err) {
      console.error('Error loading page:', err);
      setError('Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isEditMode && !pageSlug) {
      setPageSlug(generateSlug(newTitle));
    }
  };

  const autoSave = async () => {
    if (!title.trim() || !pageSlug.trim()) {
      return; // Don't auto-save invalid pages
    }

    setAutoSaveStatus('saving');

    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return; // Silently fail auto-save if not authenticated
      }

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${slug}`;

      const body = { title, description, documentType, content, externalUrl, category, newSlug: pageSlug !== slug ? pageSlug : undefined };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setAutoSaveStatus('saved');
      } else {
        setAutoSaveStatus('unsaved');
      }
    } catch (err) {
      console.error('Auto-save error:', err);
      setAutoSaveStatus('unsaved');
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !pageSlug.trim()) {
      setError('Title and slug are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expired. Please log in again.');
        return;
      }

      const url = isEditMode
        ? `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${slug}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`;

      const method = isEditMode ? 'PUT' : 'POST';

      const body = isEditMode
        ? { title, description, documentType, content, externalUrl, category, newSlug: pageSlug !== slug ? pageSlug : undefined }
        : { slug: pageSlug, title, description, documentType, content, externalUrl, category };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save page');
      }

      setAutoSaveStatus('saved');

      // Navigate to admin or update URL if slug changed
      if (isEditMode && pageSlug !== slug) {
        navigate(`/admin/pages/${pageSlug}/edit`, { replace: true });
      } else if (!isEditMode) {
        navigate('/admin');
      }
    } catch (err: any) {
      console.error('Error saving page:', err);
      setError(err.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 lg:px-8">
          <Link to="/admin" className="flex items-center gap-2 mr-6 hover:text-foreground text-muted-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Zpět do Admin</span>
          </Link>

          <h2 className="flex-1">{isEditMode ? 'Upravit stránku' : 'Nová stránka'}</h2>

          {isEditMode && (
            <div className="text-sm text-muted-foreground mr-4">
              {autoSaveStatus === 'saved' && '✓ Automaticky uloženo'}
              {autoSaveStatus === 'saving' && 'Ukládám...'}
              {autoSaveStatus === 'unsaved' && 'Neuložené změny'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded transition-colors"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Skrýt' : 'Zobrazit'} náhled
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-accent rounded"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            {error}
          </div>
        )}

        <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {/* Editor */}
          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block mb-2">Název stránky *</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full px-4 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Název stránky"
                required
              />
            </div>

            <div>
              <label htmlFor="slug" className="block mb-2">URL slug *</label>
              <input
                id="slug"
                type="text"
                value={pageSlug}
                onChange={(e) => setPageSlug(e.target.value)}
                className="w-full px-4 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                placeholder="url-strankz"
                required
              />
              <p className="mt-1 text-sm text-muted-foreground">
                URL: /docs/{category}/{pageSlug || 'url-stranky'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="category">Kategorie *</label>
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(true)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="h-3 w-3" />
                  Spravovat kategorie
                </button>
              </div>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2">Typ dokumentu</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DOCUMENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setDocumentType(type.id)}
                    className={`
                      flex flex-col items-center justify-center p-4 rounded-lg border transition-all h-32
                      ${documentType === type.id 
                        ? `bg-primary/5 border-primary ring-1 ring-primary` 
                        : 'bg-background border-border hover:border-primary/50 hover:bg-accent/50'
                      }
                    `}
                  >
                    <div className={`p-3 rounded-lg mb-3 ${type.bgColor}`}>
                      <type.icon className={`h-6 w-6 ${type.color}`} />
                    </div>
                    <span className="text-sm font-medium text-center leading-tight">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block mb-2">Popis stránky</label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Krátký popis stránky"
              />
            </div>

            <div>
              {['practice', 'test', 'exam'].includes(documentType) ? (
                <div>
                  <label htmlFor="externalUrl" className="block mb-2">Odkaz na cvičení/test *</label>
                  <input
                    id="externalUrl"
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="https://..."
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pro tento typ dokumentu se zadává pouze externí odkaz. Po kliknutí na kartu v přehledu bude uživatel přesměrován.
                  </p>
                </div>
              ) : (
                <>
                  <label htmlFor="content" className="block mb-2">Obsah stránky</label>
                  <RichTextEditor 
                    content={content}
                    onChange={setContent}
                  />
                </>
              )}
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="border border-border rounded-lg p-6 bg-card">
              <div className="mb-4 pb-4 border-b border-border">
                <h3 className="mb-2">Náhled</h3>
                <p className="text-muted-foreground text-sm">
                  Takto bude vypadat vaše stránka
                </p>
              </div>

              <div className="mb-6">
                <h1 className="mb-2">{title || 'Název stránky'}</h1>
                {description && (
                  <p className="text-muted-foreground">{description}</p>
                )}
              </div>

              {content ? (
                <HtmlRenderer content={content} />
              ) : (
                <p className="text-muted-foreground italic">Zatím žádný obsah...</p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager
          onClose={() => setShowCategoryManager(false)}
          onUpdate={() => {
            loadCategories();
          }}
        />
      )}
    </div>
  );
}
