import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, ChevronRight, ChevronDown, Moon, Sun } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LoadingSpinner } from './LoadingSpinner';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';

interface MenuItem {
  id: string;
  title: string;
  slug?: string;
  children?: MenuItem[];
}

interface Page {
  id: string;
  slug: string;
  title: string;
  category?: string;
}

interface MenuEditorProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const CATEGORIES = [
  { id: 'knihovna-vividbooks', label: 'Knihovna Vividbooks' },
  { id: 'vividboard', label: 'Vividboard' },
  { id: 'metodika', label: 'Metodika' }
];

export function MenuEditor({ theme, toggleTheme }: MenuEditorProps) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState('knihovna-vividbooks');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadData();
  }, [activeCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load menu structure for active category
      const menuResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${activeCategory}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (menuResponse.ok) {
        const menuData = await menuResponse.json();
        setMenu(menuData.menu || []);
      }

      // Load all pages
      const pagesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json();
        // Filter pages by active category
        const filteredPages = (pagesData.pages || []).filter(
          (page: Page) => page.category === activeCategory
        );
        setPages(filteredPages);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
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

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ menu, category: activeCategory })
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save menu');
      }

      alert('Menu saved successfully!');
    } catch (err: any) {
      console.error('Error saving menu:', err);
      setError(err.message || 'Failed to save menu');
    } finally {
      setSaving(false);
    }
  };

  const addGroup = () => {
    const newGroup: MenuItem = {
      id: `group-${Date.now()}`,
      title: 'New Group',
      children: []
    };
    setMenu([...menu, newGroup]);
    setExpandedItems(new Set([...expandedItems, newGroup.id]));
  };

  const addPage = (parentId?: string) => {
    const availablePage = pages.find(p => !isPageInMenu(p.slug, menu));
    
    if (!availablePage) {
      alert('All pages are already in the menu. Create new pages first.');
      return;
    }

    const newItem: MenuItem = {
      id: `item-${Date.now()}`,
      title: availablePage.title,
      slug: availablePage.slug
    };

    if (parentId) {
      const updateChildren = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
          if (item.id === parentId) {
            return {
              ...item,
              children: [...(item.children || []), newItem]
            };
          }
          if (item.children) {
            return {
              ...item,
              children: updateChildren(item.children)
            };
          }
          return item;
        });
      };
      setMenu(updateChildren(menu));
      setExpandedItems(new Set([...expandedItems, parentId]));
    } else {
      setMenu([...menu, newItem]);
    }
  };

  const isPageInMenu = (slug: string, items: MenuItem[]): boolean => {
    for (const item of items) {
      if (item.slug === slug) return true;
      if (item.children && isPageInMenu(slug, item.children)) return true;
    }
    return false;
  };

  const removeItem = (itemId: string) => {
    const removeFromItems = (items: MenuItem[]): MenuItem[] => {
      return items.filter(item => item.id !== itemId).map(item => ({
        ...item,
        children: item.children ? removeFromItems(item.children) : undefined
      }));
    };
    setMenu(removeFromItems(menu));
  };

  const updateItemTitle = (itemId: string, newTitle: string) => {
    const updateItems = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === itemId) {
          return { ...item, title: newTitle };
        }
        if (item.children) {
          return { ...item, children: updateItems(item.children) };
        }
        return item;
      });
    };
    setMenu(updateItems(menu));
  };

  const updateItemPage = (itemId: string, newSlug: string) => {
    const page = pages.find(p => p.slug === newSlug);
    if (!page) return;

    const updateItems = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === itemId) {
          return { ...item, slug: newSlug, title: page.title };
        }
        if (item.children) {
          return { ...item, children: updateItems(item.children) };
        }
        return item;
      });
    };
    setMenu(updateItems(menu));
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    // Simple reordering at root level for now
    const oldIndex = menu.findIndex(item => item.id === active.id);
    const newIndex = menu.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newMenu = [...menu];
      const [movedItem] = newMenu.splice(oldIndex, 1);
      newMenu.splice(newIndex, 0, movedItem);
      setMenu(newMenu);
    }
  };

  const renderMenuItem = (item: MenuItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isGroup = !item.slug;

    return (
      <div key={item.id} className="mb-1">
        <div
          className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors"
          style={{ marginLeft: `${depth * 1.5}rem` }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          
          {isGroup && (
            <button
              onClick={() => toggleExpanded(item.id)}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}

          {isGroup ? (
            <input
              type="text"
              value={item.title}
              onChange={(e) => updateItemTitle(item.id, e.target.value)}
              className="flex-1 px-2 py-1 bg-input-background border border-border rounded text-sm"
              placeholder="Group title"
            />
          ) : (
            <select
              value={item.slug || ''}
              onChange={(e) => updateItemPage(item.id, e.target.value)}
              className="flex-1 px-2 py-1 bg-input-background border border-border rounded text-sm"
            >
              <option value="">Select page...</option>
              {pages.map(page => (
                <option 
                  key={page.slug} 
                  value={page.slug}
                  disabled={isPageInMenu(page.slug, menu) && page.slug !== item.slug}
                >
                  {page.title}
                </option>
              ))}
            </select>
          )}

          {isGroup && (
            <button
              onClick={() => addPage(item.id)}
              className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="Add page to group"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => removeItem(item.id)}
            className="p-1.5 hover:bg-destructive/10 rounded text-destructive"
            title="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {item.children!.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
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
            <span>Back to Admin</span>
          </Link>

          <h2 className="flex-1">Menu Structure</h2>

          <div className="flex items-center gap-2">
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
              {saving ? 'Saving...' : 'Save Menu'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            {error}
          </div>
        )}

        {/* Category selector */}
        <div className="mb-6 p-4 bg-muted/50 border border-border rounded-lg">
          <h3 className="mb-3">Select Category</h3>
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`
                  px-4 py-2 rounded transition-colors
                  ${activeCategory === cat.id 
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

        <div className="mb-6 p-4 bg-muted/50 border border-border rounded-lg">
          <h3 className="mb-2">Instructions</h3>
          <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
            <li>Select a category above to edit its menu structure</li>
            <li>Drag items to reorder them</li>
            <li>Groups can contain multiple pages as children</li>
            <li>Pages without groups will appear at the root level</li>
            <li>Don't forget to save your changes</li>
          </ul>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={addGroup}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Group
          </button>

          <button
            onClick={() => addPage()}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Page
          </button>
        </div>

        {menu.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground mb-4">
              No menu items yet. Add groups and pages to build your navigation.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={menu.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {menu.map(item => renderMenuItem(item))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
}
