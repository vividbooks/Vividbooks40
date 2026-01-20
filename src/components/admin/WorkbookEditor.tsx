import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Book, ShoppingCart, FileText, Image as ImageIcon, Move, ExternalLink, Star, HelpCircle, Settings } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { SectionMediaManager } from './SectionMediaManager';

interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  type?: string;
  pageNumber?: string;
  color?: string;
  children?: MenuItem[];
}

export interface WorkbookBonus {
  id: string;
  title: string;
  link: string;
}

export interface WorkbookData {
  coverImage?: string;
  color?: string;
  author?: string;
  purchaseUrl?: string;
  bonuses?: WorkbookBonus[];
}

export const DEFAULT_WORKBOOK_DATA: WorkbookData = {
  coverImage: '',
  color: '',
  author: '',
  purchaseUrl: '',
  bonuses: [],
};

interface WorkbookEditorProps {
  data: WorkbookData;
  onChange: (data: WorkbookData) => void;
  slug: string;
  category: string;
}

export function WorkbookEditor({ data, onChange, slug, category }: WorkbookEditorProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'settings' | 'content'>('content');
  const [menu, setMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings' || tab === 'content') {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [allPages, setAllPages] = useState<MenuItem[]>([]);
  const [worksheetPages, setWorksheetPages] = useState<{id: string; title: string; slug: string; category: string}[]>([]);
  const [loadingWorksheets, setLoadingWorksheets] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentMenuItem, setCurrentMenuItem] = useState<MenuItem | null>(null);

  // Available categories
  const categories = [
    { id: 'knihovna-vividbooks', label: 'Knihovna Vividbooks' },
    { id: 'fyzika', label: 'Fyzika' },
    { id: 'chemie', label: 'Chemie' },
    { id: 'prirodopis', label: 'Přírodopis' },
    { id: 'matematika', label: 'Matematika' },
  ];

  useEffect(() => {
    loadMenu();
  }, [category]);

  // Load worksheet pages from all categories or selected category
  useEffect(() => {
    loadWorksheetPages();
  }, [selectedCategory]);

  const loadWorksheetPages = async () => {
    setLoadingWorksheets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const categoriesToLoad = selectedCategory ? [selectedCategory] : categories.map(c => c.id);
      
      const allWorksheets: {id: string; title: string; slug: string; category: string}[] = [];
      
      for (const cat of categoriesToLoad) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages?category=${cat}`,
          {
            headers: {
              'Authorization': `Bearer ${session?.access_token || publicAnonKey}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const pages = data.pages || [];
          // Filter only worksheet pages
          const worksheets = pages
            .filter((p: any) => p.documentType === 'worksheet')
            .map((p: any) => ({
              id: p.id || p.slug,
              title: p.title,
              slug: p.slug,
              category: cat
            }));
          allWorksheets.push(...worksheets);
        }
      }
      
      setWorksheetPages(allWorksheets);
    } catch (err) {
      console.error('Error loading worksheet pages:', err);
    } finally {
      setLoadingWorksheets(false);
    }
  };

  useEffect(() => {
    // Find current menu item based on slug
    if (menu.length > 0) {
      const findItem = (items: MenuItem[]): MenuItem | null => {
        for (const item of items) {
          if (item.slug === slug) return item;
          if (item.children) {
            const found = findItem(item.children);
            if (found) return found;
          }
        }
        return null;
      };
      const item = findItem(menu);
      setCurrentMenuItem(item);
      
      // Collect all pages for selection (Unique by slug) - kept for backward compatibility
      const collectPages = (items: MenuItem[]): MenuItem[] => {
        const uniquePages = new Map<string, MenuItem>();
        
        const traverse = (nodes: MenuItem[]) => {
          nodes.forEach(node => {
            if (node.slug) {
              if (!uniquePages.has(node.slug)) {
                uniquePages.set(node.slug, node);
              }
            }
            if (node.children) {
              traverse(node.children);
            }
          });
        };
        traverse(items);
        return Array.from(uniquePages.values());
      };
      setAllPages(collectPages(menu));
    }
  }, [menu, slug]);

  const loadMenu = async () => {
    setLoadingMenu(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMenu(data.menu || []);
      }
    } catch (err) {
      console.error('Error loading menu:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  const updateField = (field: keyof WorkbookData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const saveMenuColor = async (color: string) => {
    if (!currentMenuItem) return;

    const updateMenuColor = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === currentMenuItem.id) {
          return { ...item, color };
        }
        if (item.children) {
          return { ...item, children: updateMenuColor(item.children) };
        }
        return item;
      });
    };

    const updated = updateMenuColor(menu);
    setMenu(updated);
    await saveMenu(updated);
  };

  const saveMenu = async (updatedMenu: MenuItem[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`
          },
          body: JSON.stringify({
            category: category,
            menu: updatedMenu
          })
        }
      );

      if (response.ok) {
        setMenu(updatedMenu);
      }
    } catch (err) {
      console.error('Error saving menu:', err);
    }
  };

  const handleAddPageToWorkbook = async () => {
    if (!selectedPageId || !currentMenuItem) return;

    const pageToAdd = worksheetPages.find(p => p.slug === selectedPageId);
    if (!pageToAdd) return;

    // Check if already in workbook
    const isAlreadyInWorkbook = currentMenuItem.children?.some(
      child => child.slug === pageToAdd.slug
    );

    if (isAlreadyInWorkbook) {
      alert('Tato stránka již v sešitu je.');
      return;
    }

    // Helper to remove item from menu tree
    const removeItemFromTree = (items: MenuItem[], slugToRemove: string): MenuItem[] => {
      return items.filter(item => {
        if (item.slug === slugToRemove) return false;
        if (item.children) {
          item.children = removeItemFromTree(item.children, slugToRemove);
        }
        return true;
      });
    };

    // 1. Remove from old location(s) - DISABLED (Reverted to Link/Shortcut behavior)
    // let newMenu = removeItemFromTree([...menu], pageToAdd.slug);
    let newMenu = [...menu];

    // 2. Add to workbook
    const findAndAddToWorkbook = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === currentMenuItem.id) {
           const newChild: MenuItem = {
              id: crypto.randomUUID(),
              label: pageToAdd.title,
              slug: pageToAdd.slug,
              children: []
           };
           return {
             ...item,
             children: [...(item.children || []), newChild]
           };
        }
        if (item.children) {
          return { ...item, children: findAndAddToWorkbook(item.children) };
        }
        return item;
      });
    };

    newMenu = findAndAddToWorkbook(newMenu);
    await saveMenu(newMenu);
    setSelectedPageId('');
  };

  const handleRemovePageFromWorkbook = async (childId: string) => {
    if (!confirm('Opravdu odebrat tuto stránku ze sešitu? Stránka samotná nebude smazána.')) return;

    const findAndUpdate = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === currentMenuItem?.id) {
          return {
            ...item,
            children: (item.children || []).filter(child => child.id !== childId)
          };
        }
        if (item.children) {
          return {
            ...item,
            children: findAndUpdate(item.children)
          };
        }
        return item;
      });
    };

    const updatedMenu = findAndUpdate(menu);
    await saveMenu(updatedMenu);
  };

  const handlePageNumberChange = (childId: string, newNumber: string) => {
    const findAndUpdate = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === currentMenuItem?.id) {
          return {
            ...item,
            children: (item.children || []).map(child => 
              child.id === childId ? { ...child, pageNumber: newNumber } : child
            )
          };
        }
        if (item.children) {
          return {
            ...item,
            children: findAndUpdate(item.children)
          };
        }
        return item;
      });
    };
    setMenu(findAndUpdate(menu));
  };

  const handlePageNumberBlur = () => {
    saveMenu(menu);
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'content' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Obsah sešitu
          </div>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'settings' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            Vlastnosti složky
          </div>
        </button>
      </div>

      {activeTab === 'settings' ? (
        <div className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Náhledový obrázek (URL)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={data.coverImage || ''} 
                  onChange={(e) => updateField('coverImage', e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm"
                  placeholder="https://..." 
                />
              </div>
              {data.coverImage && (
                <div className="mt-2 w-32 h-40 bg-muted rounded overflow-hidden border border-border">
                  <img src={data.coverImage} alt="Cover" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Barva složky</label>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg border border-border overflow-hidden shadow-sm">
                  <input 
                    type="color" 
                    value={data.color || '#ffffff'} 
                    onChange={(e) => updateField('color', e.target.value)}
                    onBlur={(e) => saveMenuColor(e.target.value)}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                  />
                </div>
                <input 
                  type="text" 
                  value={data.color || ''} 
                  onChange={(e) => updateField('color', e.target.value)}
                  onBlur={(e) => saveMenuColor(e.target.value)}
                  className="w-32 px-3 py-2 bg-background border border-border rounded text-sm font-mono uppercase"
                  placeholder="#000000"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vyberte barvu pro identifikaci složky v seznamu.
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Autor</label>
              <input 
                type="text" 
                value={data.author || ''} 
                onChange={(e) => updateField('author', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                placeholder="Jméno autora..." 
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Odkaz na zakoupení sešitu</label>
              <input 
                type="text" 
                value={data.purchaseUrl || ''} 
                onChange={(e) => updateField('purchaseUrl', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                placeholder="https://..." 
              />
            </div>
          </div>

          {/* Bonuses Section */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium">Bonusy</label>
              <button
                type="button"
                onClick={() => {
                  const newBonus: WorkbookBonus = {
                    id: crypto.randomUUID(),
                    title: '',
                    link: ''
                  };
                  updateField('bonuses', [...(data.bonuses || []), newBonus]);
                }}
                className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20"
              >
                <Plus className="h-4 w-4" /> Přidat bonus
              </button>
            </div>
            
            {(!data.bonuses || data.bonuses.length === 0) ? (
              <p className="text-muted-foreground text-sm italic">Žádné bonusy.</p>
            ) : (
              <div className="space-y-3">
                {data.bonuses.map((bonus, index) => (
                  <div key={bonus.id} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
                    <div className="flex-1 grid gap-3">
                      <input
                        type="text"
                        value={bonus.title}
                        onChange={(e) => {
                          const updated = [...(data.bonuses || [])];
                          updated[index] = { ...bonus, title: e.target.value };
                          updateField('bonuses', updated);
                        }}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        placeholder="Název bonusu"
                      />
                      <input
                        type="text"
                        value={bonus.link}
                        onChange={(e) => {
                          const updated = [...(data.bonuses || [])];
                          updated[index] = { ...bonus, link: e.target.value };
                          updateField('bonuses', updated);
                        }}
                        className="w-full px-3 py-2 border rounded-md text-sm font-mono text-muted-foreground"
                        placeholder="https://..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (data.bonuses || []).filter(b => b.id !== bonus.id);
                        updateField('bonuses', updated);
                      }}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-muted/20 border border-border rounded-lg p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Book className="h-4 w-4 text-indigo-600" />
              Stránky v sešitu
            </h3>
            
            {!currentMenuItem ? (
              <div className="text-center py-8 text-muted-foreground">
                {loadingMenu ? 'Načítám strukturu...' : 'Sešit nebyl nalezen ve struktuře menu. Ujistěte se, že je správně vytvořen.'}
              </div>
            ) : (
              <div className="space-y-1">
                {(currentMenuItem.children || []).map((child, index) => (
                  <div 
                    key={child.id} 
                    onClick={() => navigate(`/admin/${category}/${child.slug}`)}
                    className="flex items-center gap-3 p-3 bg-white border border-border rounded-md group hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={child.pageNumber !== undefined ? child.pageNumber : (index + 1).toString()}
                        onChange={(e) => handlePageNumberChange(child.id, e.target.value)}
                        onBlur={handlePageNumberBlur}
                        className="w-8 h-8 bg-slate-100 text-slate-500 text-xs font-medium rounded-full text-center border-none focus:ring-2 focus:ring-primary outline-none p-0"
                      />
                    </div>
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-700 flex-1">{child.label}</span>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-mono">
                      {child.slug}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePageFromWorkbook(child.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 text-destructive rounded transition-opacity"
                      title="Odebrat ze sešitu"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                
                {(!currentMenuItem.children || currentMenuItem.children.length === 0) && (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                    <p className="text-muted-foreground text-sm">Tento sešit je zatím prázdný.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add Page Section */}
          <div className="border-t border-border pt-6">
            <h4 className="text-sm font-bold uppercase text-muted-foreground mb-3">Přidat pracovní list</h4>
            
            {/* Category filter */}
            <div className="mb-3 max-w-xl">
              <label className="block text-xs text-muted-foreground mb-1">Filtrovat podle předmětu:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="">Všechny předměty</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2 max-w-xl">
              <div className="flex-1">
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  disabled={loadingWorksheets}
                >
                  <option value="">
                    {loadingWorksheets ? 'Načítám pracovní listy...' : 'Vyberte pracovní list...'}
                  </option>
                  {worksheetPages.map(p => (
                    <option key={p.slug} value={p.slug}>
                      {p.title} ({categories.find(c => c.id === p.category)?.label || p.category})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddPageToWorkbook}
                disabled={!selectedPageId || loadingWorksheets}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Přidat
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Zobrazují se pouze stránky typu "Pracovní list". Vyberte pracovní list a přidejte ho do sešitu.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
