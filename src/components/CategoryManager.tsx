import { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { createClient } from '@supabase/supabase-js';

interface Category {
  id: string;
  label: string;
}

interface CategoryManagerProps {
  onClose: () => void;
  onUpdate: () => void;
}

export function CategoryManager({ onClose, onUpdate }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
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
      setError('Nepodařilo se načíst kategorie');
    } finally {
      setLoading(false);
    }
  };

  const generateId = (label: string) => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleAddCategory = async () => {
    if (!newCategoryLabel.trim()) {
      setError('Zadejte název kategorie');
      return;
    }

    const newId = generateId(newCategoryLabel);
    
    // Check if ID already exists
    if (categories.some(cat => cat.id === newId)) {
      setError('Kategorie s tímto názvem již existuje');
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
        setError('Relace vypršela. Přihlaste se znovu.');
        return;
      }

      const newCategory = { id: newId, label: newCategoryLabel.trim() };
      const updatedCategories = [...categories, newCategory];

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/categories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ categories: updatedCategories })
        }
      );

      if (response.ok) {
        setCategories(updatedCategories);
        setNewCategoryLabel('');
        onUpdate();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Nepodařilo se přidat kategorii');
      }
    } catch (err: any) {
      console.error('Error adding category:', err);
      setError(err.message || 'Nepodařilo se přidat kategorii');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Opravdu chcete smazat tuto kategorii? Stránky v této kategorii zůstanou zachovány.')) {
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
        setError('Relace vypršela. Přihlaste se znovu.');
        return;
      }

      const updatedCategories = categories.filter(cat => cat.id !== categoryId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/categories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ categories: updatedCategories })
        }
      );

      if (response.ok) {
        setCategories(updatedCategories);
        onUpdate();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Nepodařilo se smazat kategorii');
      }
    } catch (err: any) {
      console.error('Error deleting category:', err);
      setError(err.message || 'Nepodařilo se smazat kategorii');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2>Správa kategorií</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded transition-colors"
            aria-label="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
              {error}
            </div>
          )}

          {/* Add new category */}
          <div className="mb-6">
            <label className="block mb-2">Přidat novou kategorii</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="Název kategorie"
                className="flex-1 px-4 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={saving}
              />
              <button
                onClick={handleAddCategory}
                disabled={saving || !newCategoryLabel.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Přidat
              </button>
            </div>
          </div>

          {/* Categories list */}
          <div>
            <label className="block mb-3">Existující kategorie</label>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Načítám kategorie...
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Zatím žádné kategorie
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded border border-border"
                  >
                    <div>
                      <div>{category.label}</div>
                      <div className="text-sm text-muted-foreground font-mono">
                        ID: {category.id}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={saving}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded transition-colors disabled:opacity-50"
                      title="Smazat kategorii"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
}
