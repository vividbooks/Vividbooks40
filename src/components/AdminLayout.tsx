import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Menu as MenuIcon, Plus, LogOut, Moon, Sun, Settings, BookOpen } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { samplePages, sampleMenu } from '../utils/sampleContent.ts';

interface Page {
  id: string;
  slug: string;
  title: string;
  description: string;
  category?: string;
  updatedAt: string;
}

interface AdminLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onLogout: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'knihovna-vividbooks', label: 'Knihovna Vividbooks' },
  { id: 'vividboard', label: 'Vividboard' },
  { id: 'metodika', label: 'Metodika' }
];

export function AdminLayout({ theme, toggleTheme, onLogout }: AdminLayoutProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPages(data.pages || []);
      }
    } catch (err) {
      console.error('Error loading pages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Are you sure you want to delete this page?')) {
      return;
    }

    setDeleting(slug);
    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Session expired. Please log in again.');
        onLogout();
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${slug}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (response.ok) {
        setPages(pages.filter(p => p.slug !== slug));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete page');
      }
    } catch (err) {
      console.error('Error deleting page:', err);
      alert('Failed to delete page');
    } finally {
      setDeleting(null);
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );
      
      await supabase.auth.signOut();
      onLogout();
    } catch (err) {
      console.error('Logout error:', err);
      onLogout();
    }
  };

  const loadSampleContent = async () => {
    if (!confirm('This will create sample VividBooks documentation pages. Continue?')) {
      return;
    }

    setLoadingSample(true);
    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Session expired. Please log in again.');
        onLogout();
        return;
      }

      // Create all sample pages
      for (const page of samplePages) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(page)
          }
        );
      }

      // Update menu structure for all categories
      const categories = ['knihovna-vividbooks', 'vividboard', 'metodika'];
      for (const category of categories) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ 
              menu: sampleMenu[category as keyof typeof sampleMenu], 
              category 
            })
          }
        );
      }

      // Reload pages
      await loadPages();
      alert('Sample content loaded successfully!');
    } catch (err) {
      console.error('Error loading sample content:', err);
      alert('Failed to load sample content');
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 lg:px-8">
          <Link to="/admin" className="mr-6">
            <span className="font-bold">Admin Panel</span>
          </Link>

          <nav className="flex items-center gap-4 flex-1">
            <Link 
              to="/admin" 
              className="text-sm hover:text-foreground text-muted-foreground transition-colors"
            >
              Pages
            </Link>
            <Link 
              to="/admin/menu" 
              className="text-sm hover:text-foreground text-muted-foreground transition-colors"
            >
              Menu Structure
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/docs/knihovna-vividbooks/introduction"
              target="_blank"
              className="px-3 py-1.5 text-sm hover:bg-accent rounded transition-colors"
            >
              View Docs
            </Link>

            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-accent rounded"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="mb-2">Documentation Pages</h1>
            <p className="text-muted-foreground">
              Manage your documentation pages and content
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pages.length === 0 && !loading && (
              <button
                onClick={loadSampleContent}
                disabled={loadingSample}
                className="flex items-center gap-2 border border-border px-4 py-2 rounded hover:bg-accent transition-colors disabled:opacity-50"
              >
                <BookOpen className="h-4 w-4" />
                {loadingSample ? 'Loading...' : 'Load Sample Content'}
              </button>
            )}
            <Link
              to="/admin/pages/new"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              New Page
            </Link>
          </div>
        </div>

        {/* Category Filter */}
        {pages.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`
                    px-4 py-2 rounded transition-colors text-sm
                    ${categoryFilter === cat.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'border border-border hover:bg-accent'
                    }
                  `}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : pages.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="mb-2">No pages yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first documentation page to get started
            </p>
            <Link
              to="/admin/pages/new"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Create Page
            </Link>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Slug</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Updated</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages
                  .filter(page => categoryFilter === 'all' || page.category === categoryFilter)
                  .map((page, index) => (
                  <tr 
                    key={page.id}
                    className={`
                      border-t border-border hover:bg-muted/30 transition-colors
                      ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                    `}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/pages/${page.slug}/edit`}
                        className="hover:text-primary transition-colors"
                      >
                        {page.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {CATEGORIES.find(c => c.id === page.category)?.label || 'Knihovna Vividbooks'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm bg-muted px-2 py-0.5 rounded">
                        {page.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {page.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/pages/${page.slug}/edit`}
                          className="px-3 py-1 text-sm hover:bg-accent rounded transition-colors"
                        >
                          Edit
                        </Link>
                        <Link
                          to={`/docs/${page.category || 'knihovna-vividbooks'}/${page.slug}`}
                          target="_blank"
                          className="px-3 py-1 text-sm hover:bg-accent rounded transition-colors"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(page.slug)}
                          disabled={deleting === page.slug}
                          className="px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                        >
                          {deleting === page.slug ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
