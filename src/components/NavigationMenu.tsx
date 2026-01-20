import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Book, LayoutGrid, Atom, FlaskConical, Leaf, Calculator, FileText, Sprout, ChevronDown, ChevronRight, Folder, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { getIcon as getFileIcon } from './IconPicker';
import { LoadingSpinner } from './LoadingSpinner';
import { DOCUMENT_TYPES } from '../types/document-types';

interface CategoryItem {
  id: string;
  label: string;
  color?: string;
}

export interface MenuGroup {
  title?: string;
  items: CategoryItem[];
}

interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  icon?: string;
  type?: string;
  children?: MenuItem[];
  color?: string;
  externalUrl?: string;
  pageNumber?: string;
  coverImage?: string;
}

interface NavigationMenuProps {
  groups?: MenuGroup[];
  activeCategory: string;
  activeTab: 'folders' | 'workbooks';
  onTabChange: (tab: 'folders' | 'workbooks') => void;
  onNavigate?: () => void;
  showTree?: boolean;
  currentSlug?: string;
  canViewFolders?: boolean; // License-based restriction
  isStudentMode?: boolean; // Whether to filter content for students
  hideTabSwitcher?: boolean; // Hide the Složky/Sešity tab switcher
}

export function NavigationMenu({ 
  groups, 
  activeCategory, 
  onNavigate, 
  activeTab, 
  onTabChange, 
  showTree = false, 
  currentSlug,
  canViewFolders = true,
  isStudentMode = false,
  hideTabSwitcher = false
}: NavigationMenuProps) {
  
  // Filter items that should be hidden for students
  // Students should NOT see: metodická inspirace, řešení pdf, testy, písemky
  const filterForStudentMode = useCallback((items: MenuItem[]): MenuItem[] => {
    if (!isStudentMode) return items;
    
    const hiddenKeywords = [
      'metodická inspirace', 'metodicka inspirace',
      'řešení', 'reseni', 'řešení pdf',
      'test', 'testy', 'písemka', 'písemky', 'pisemka', 'pisemky'
    ];
    
    const shouldHide = (label: string): boolean => {
      const normalized = label.toLowerCase();
      return hiddenKeywords.some(keyword => normalized.includes(keyword));
    };
    
    return items
      .filter(item => !shouldHide(item.label))
      .map(item => ({
        ...item,
        children: item.children ? filterForStudentMode(item.children) : undefined
      }));
  }, [isStudentMode]);
  const navigate = useNavigate();

  // --- Tree Logic ---
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const manualTabSwitchRef = useRef(false); // Track if user manually switched tabs

  // Workbook selection mode - when true, shows list of workbooks without expansion
  const [workbookSelectionMode, setWorkbookSelectionMode] = useState(true);
  
  // Folder selection mode - when true, shows list of top-level folders
  // When false, shows only the current folder and its content
  const [folderSelectionMode, setFolderSelectionMode] = useState(true);
  const [currentTopLevelFolder, setCurrentTopLevelFolder] = useState<MenuItem | null>(null);
  
  // Track if tab was manually switched (not auto-switched due to page type)
  const manualTabSwitchRef2 = useRef(false);
  
  // When on workbooks tab with a specific slug, exit selection mode
  // When on workbooks tab without slug (overview), show selection mode
  useEffect(() => {
    if (activeTab === 'workbooks') {
      if (currentSlug) {
        // Has a specific page - show workbook content, not selection
        setWorkbookSelectionMode(false);
      } else {
        // No specific page (overview) - show selection mode
        setWorkbookSelectionMode(true);
      }
    }
  }, [activeTab, currentSlug]);

  // Helper to normalize strings for comparison (removes diacritics and case)
  const normalize = useCallback((str?: string) => {
    return str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || '';
  }, []);
  
  // Helper to find which top-level folder contains the current slug
  const findTopLevelFolderForSlug = useCallback((items: MenuItem[], slug: string): MenuItem | null => {
    if (!slug) return null;
    
    const slugSegments = slug.split('/').filter(Boolean);
    const firstSegment = slugSegments[0];
    const lastSegment = slugSegments[slugSegments.length - 1] || slug;
    const lastSegmentNorm = normalize(lastSegment);
    const slugNorm = normalize(slug);
    
    for (const item of items) {
      // Check if this top-level item matches the first segment of the slug (classic path case)
      const itemSlugNorm = normalize(item.slug);
      const itemLastSegment = item.slug?.includes('/') 
        ? normalize(item.slug.split('/').pop() || '') 
        : itemSlugNorm;
      const itemLabelNorm = normalize(item.label);
      const firstSegmentNorm = normalize(firstSegment);
      
      // Match by slug OR label (label helps when top-level items don't have stable slugs)
      if (itemSlugNorm === firstSegmentNorm || itemLastSegment === firstSegmentNorm || itemLabelNorm === firstSegmentNorm) {
        return item;
      }

      // Also match by last segment / full slug / id (covers UUID-only URLs like /docs/fyzika/<uuid>)
      if (
        item.id === slug ||
        item.id === lastSegment ||
        itemSlugNorm === slugNorm ||
        itemLastSegment === lastSegmentNorm ||
        itemSlugNorm === lastSegmentNorm
      ) {
        return item;
      }
      
      // Check if any child matches - meaning we're inside this folder
      if (item.children) {
        const searchChildren = (children: MenuItem[]): boolean => {
          for (const child of children) {
            const childSlugNorm = normalize(child.slug);
            const childLastSegment = child.slug?.includes('/') 
              ? normalize(child.slug.split('/').pop() || '') 
              : childSlugNorm;
            const childLabelNorm = normalize(child.label);
            
            // Match by slug last segment OR label (label helps for “folders without slug” cases)
            if (
              child.id === slug ||
              child.id === lastSegment ||
              childSlugNorm === slugNorm ||
              childSlugNorm === lastSegmentNorm ||
              childLastSegment === lastSegmentNorm ||
              childLabelNorm === lastSegmentNorm
            ) {
              return true;
            }
            if (child.children && searchChildren(child.children)) {
              return true;
            }
          }
          return false;
        };
        
        if (searchChildren(item.children)) {
          return item;
        }
      }
    }
    return null;
  }, [normalize]);
  
  // When on folders tab with a specific slug, find and show the containing top-level folder
  useEffect(() => {
    if (activeTab === 'folders' && currentSlug && menu.length > 0) {
      // Filter to get only folder items (not workbooks)
      const foldersMenu = menu.filter(item => {
        const isWorkbook = item.type === 'workbook' || item.icon === 'workbook' || item.icon === 'book';
        return !isWorkbook;
      });
      
      const topFolder = findTopLevelFolderForSlug(foldersMenu, currentSlug);
      if (topFolder) {
        setCurrentTopLevelFolder(topFolder);
        setFolderSelectionMode(false);
      }
    } else if (activeTab === 'folders' && !currentSlug) {
      setFolderSelectionMode(true);
      setCurrentTopLevelFolder(null);
    }
  }, [activeTab, currentSlug, menu, findTopLevelFolderForSlug]);

  // Helper to check if an item matches a slug (handles various slug formats)
  const isSlugMatch = useCallback((itemSlug: string | undefined, targetSlug: string): boolean => {
    if (!itemSlug) return false;
    
    // Extract just the last segment from the target slug for comparison
    const targetLastSegment = targetSlug.includes('/') ? targetSlug.split('/').pop() || targetSlug : targetSlug;
    
    // Also get the last segment of the item slug (in case item has full path slug)
    const itemLastSegment = itemSlug.includes('/') ? itemSlug.split('/').pop() || itemSlug : itemSlug;
    
    // Match by exact slug, normalized slug, or last segment match
    return itemSlug === targetSlug || 
           itemSlug === targetLastSegment ||
           normalize(itemSlug) === normalize(targetSlug) ||
           normalize(itemSlug) === normalize(targetLastSegment) ||
           normalize(itemLastSegment) === normalize(targetLastSegment);
  }, [normalize]);

  // Helper to find recursive parent IDs (strictly parents, excluding self)
  // Match by exact slug, normalized slug, last segment of path, or id
  const findParentIds = useCallback((items: MenuItem[], targetSlug: string, parents: string[] = []): string[] | null => {
    // Extract last segment from target slug for comparison (e.g., 'zaklady/hmota' -> 'hmota')
    const targetLastSegment = targetSlug.includes('/') ? targetSlug.split('/').pop() || targetSlug : targetSlug;
    
    for (const item of items) {
      // Check if this item matches the target
      const isMatch = 
        item.slug === targetSlug || 
        item.slug === targetLastSegment ||
        normalize(item.slug) === normalize(targetSlug) || 
        normalize(item.slug) === normalize(targetLastSegment) ||
        item.id === targetSlug;
      
      if (isMatch) {
        return parents;
      }

      if (item.children) {
        const found = findParentIds(item.children, targetSlug, [...parents, item.id]);
        if (found !== null) {
           return found;
        }
      }
    }
    return null;
  }, [normalize]);

  // Helper to find the item itself (search by slug OR id)
  const findItemBySlug = useCallback((items: MenuItem[], slug: string): MenuItem | null => {
      // Extract last segment from slug for comparison
      const lastSegment = slug.includes('/') ? slug.split('/').pop() || slug : slug;
      
      for (const item of items) {
          // Match by slug (exact, normalized, or last segment) OR by id
          if (
            item.slug === slug || 
            item.slug === lastSegment ||
            normalize(item.slug) === normalize(slug) || 
            normalize(item.slug) === normalize(lastSegment) ||
            item.id === slug
          ) return item;
          if (item.children) {
              const found = findItemBySlug(item.children, slug);
              if (found) return found;
          }
      }
      return null;
  }, [normalize]);
  
  // Helper to find a chain of ids that represents the hierarchy for a slug path
  // This walks the path segment by segment, building the parent chain
  const findIdChainBySlugPath = useCallback((items: MenuItem[], segments: string[], path: string[] = []): string[] | null => {
      if (segments.length === 0) return path.length > 0 ? path : null;
      
      const [currentSegment, ...rest] = segments;
      const normalizedSegment = normalize(currentSegment);
      
      for (const item of items) {
        // Check if this item matches the current segment
        const itemSlugNorm = normalize(item.slug);
        const itemLastSegment = item.slug?.includes('/') 
          ? normalize(item.slug.split('/').pop() || '') 
          : itemSlugNorm;
        
        // Also check item label as fallback
        const itemLabelNorm = normalize(item.label);
        
        if (itemSlugNorm === normalizedSegment || itemLastSegment === normalizedSegment || itemLabelNorm === normalizedSegment) {
          const newPath = [...path, item.id];
          
          // If no more segments, we found the target
          if (rest.length === 0) {
            return newPath;
          }
          
          // Continue searching in children for remaining segments
          if (item.children) {
            const childPath = findIdChainBySlugPath(item.children, rest, newPath);
            if (childPath) return childPath;
          }
        }
      }
      
      // If no match at this level, try searching children without consuming segment
      // (handles cases where intermediate folders might not be in menu)
      for (const item of items) {
        if (item.children) {
          const childPath = findIdChainBySlugPath(item.children, segments, path);
          if (childPath) return childPath;
        }
      }
      
      return null;
  }, [normalize]);
  
  // NEW: Find item by last slug segment and return full path to it
  // This is more robust than segment-by-segment matching
  const findItemWithPath = useCallback((items: MenuItem[], targetSlug: string, path: string[] = []): { item: MenuItem, path: string[] } | null => {
      const targetLastSegment = targetSlug.includes('/') ? targetSlug.split('/').pop() || targetSlug : targetSlug;
      const normalizedTarget = normalize(targetLastSegment);
      
      for (const item of items) {
        const currentPath = [...path, item.id];
        
        // Check if this item matches the target
        const itemSlugNorm = normalize(item.slug);
        const itemLastSegment = item.slug?.includes('/') 
          ? normalize(item.slug.split('/').pop() || '') 
          : itemSlugNorm;
        const itemLabelNorm = normalize(item.label);
        
        if (itemSlugNorm === normalizedTarget || itemLastSegment === normalizedTarget || itemLabelNorm === normalizedTarget) {
          return { item, path: currentPath };
        }
        
        // Recursively search children
        if (item.children) {
          const found = findItemWithPath(item.children, targetSlug, currentPath);
          if (found) return found;
        }
      }
      
      return null;
  }, [normalize]);
  
  // Helper to find the parent workbook of current page (or the workbook itself if we're on workbook page)
  const findCurrentWorkbook = useCallback((items: MenuItem[], slug: string): MenuItem | null => {
      if (!slug) return null;
      
      // Try to match the full path or the last segment
      const pageSlug = slug.includes('/') ? slug.split('/').pop() || slug : slug;
      // Also try to get the workbook slug from path like "workbook-slug/page-slug"
      const pathParts = slug.split('/');
      const possibleWorkbookSlug = pathParts.length > 0 ? pathParts[0] : '';
      
      for (const item of items) {
        const isWorkbook = item.type === 'workbook' || item.icon === 'workbook' || item.icon === 'book';
        
        if (isWorkbook) {
          // Check if this workbook matches the slug directly (we're on workbook page)
          if (item.slug === pageSlug || normalize(item.slug) === normalize(pageSlug)) {
            return item;
          }
          
          // Check if this workbook matches the first part of path
          if (item.slug === possibleWorkbookSlug || normalize(item.slug) === normalize(possibleWorkbookSlug)) {
            return item;
          }
          
          // Check if any child matches the slug (we're on a page inside workbook)
          if (item.children) {
            for (const child of item.children) {
              if (child.slug === pageSlug || normalize(child.slug) === normalize(pageSlug)) {
                return item; // Return the parent workbook
              }
            }
          }
        }
        
        // Recursively search non-workbook items
        if (!isWorkbook && item.children) {
          const found = findCurrentWorkbook(item.children, slug);
              if (found) return found;
          }
      }
      return null;
  }, [normalize]);

  // Load menu data
  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${activeCategory}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        let loadedMenu = data.menu || [];
        
        // HOTFIX: Filter out corrupted "Pracovní list" item that cannot be deleted
        // We filter out items labeled "Pracovní list" unless they have children (meaning they are valid folders)
        const filterCorrupted = (items: MenuItem[]): MenuItem[] => {
           return items.filter(item => {
              // Remove if label is "Pracovní list" and it has no children (is a file)
              if (item.label === 'Pracovní list' && (!item.children || item.children.length === 0)) {
                 return false;
              }
              // Recursively filter children
              if (item.children) {
                 item.children = filterCorrupted(item.children);
              }
              return true;
           });
        };
        
        loadedMenu = filterCorrupted(loadedMenu);
        
        // Filter for student mode (hide metodická inspirace, řešení, testy)
        loadedMenu = filterForStudentMode(loadedMenu);
        
        // Transform workbookPages to children for workbooks
        const transformWorkbooks = (items: MenuItem[]): MenuItem[] => {
          return items.map(item => {
            if (item.type === 'workbook' && (item as any).workbookPages && (item as any).workbookPages.length > 0) {
              const pages = (item as any).workbookPages as { id: string; pageNumber: number; worksheetId: string; worksheetSlug: string; worksheetLabel: string; worksheetCover?: string }[];
              const children: MenuItem[] = pages
                .sort((a, b) => a.pageNumber - b.pageNumber)
                .map(page => {
                  const baseLabel = page.worksheetLabel;
                  // Remove existing "str. XX" prefix if present to avoid duplication
                  const cleanLabel = baseLabel.replace(/^str\.?\s*\d+\s*/i, '').trim();
                  return {
                    id: page.worksheetId,
                    label: `str. ${page.pageNumber} ${cleanLabel}`,
                    slug: page.worksheetSlug,
                    type: 'worksheet',
                    coverImage: page.worksheetCover,
                    pageNumber: String(page.pageNumber),
                  };
                });
              return { ...item, children };
            }
            if (item.children) {
              return { ...item, children: transformWorkbooks(item.children) };
            }
            return item;
          });
        };
        loadedMenu = transformWorkbooks(loadedMenu);

        // console.log('NavigationMenu - Loaded menu:', loadedMenu);
        setMenu(loadedMenu);
      }
    } catch (err) {
      console.error('Error loading menu:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, filterForStudentMode]);

  // Initial load
  useEffect(() => {
    if (showTree) {
       loadMenu();
    }
  }, [showTree, activeCategory, loadMenu]);

  // Sync expansion when currentSlug changes (e.g. navigation from dashboard)
  // Uses path-based matching to correctly handle duplicate slugs at different levels
  useEffect(() => {
    if (showTree && currentSlug && menu.length > 0) {
      let idsToExpand: string[] = [];
      let currentItem: MenuItem | null = null;
      
      // Strategy 1: Path-based matching (BEST for nested paths like 'zaklady/hmota/castice-hmoty')
      // This walks the path segment by segment, ensuring we find the RIGHT item
      if (currentSlug.includes('/')) {
        const slugSegments = currentSlug.split('/').filter(Boolean);
        const idChain = findIdChainBySlugPath(menu, slugSegments);
        
        if (idChain && idChain.length > 0) {
          // idChain includes the current item, so we need all but the last for parents
          idsToExpand = idChain.slice(0, -1);
          // Get the last id to find the current item
          const lastId = idChain[idChain.length - 1];
          // Find item by id
          const findById = (items: MenuItem[], id: string): MenuItem | null => {
            for (const item of items) {
              if (item.id === id) return item;
              if (item.children) {
                const found = findById(item.children, id);
                if (found) return found;
              }
            }
            return null;
          };
          currentItem = findById(menu, lastId);
        }
      }
      
      // Strategy 2: Fallback - use findParentIds which searches by last segment
      // This handles cases where path-based matching fails or for single-segment slugs
      if (idsToExpand.length === 0) {
        const lastSegment = currentSlug.includes('/') ? currentSlug.split('/').pop() || currentSlug : currentSlug;
        const parentsToExpand = findParentIds(menu, lastSegment) || [];
        currentItem = findItemBySlug(menu, lastSegment);
        idsToExpand = [...parentsToExpand];
      }
      
      // Check if we should expand the current item
      if (currentItem && (currentItem.children?.length ?? 0) > 0) {
          // User request: Do not automatically expand the folder if it only contains files (no subfolders).
          // We only expand if it contains at least one subfolder.
          const hasSubFolders = currentItem.children.some(child => 
              child.type === 'group' || 
              child.type === 'folder' || 
              (child.children && child.children.length > 0)
          );

          // Only expand if there are subfolders
          if (hasSubFolders) {
              if (!idsToExpand.includes(currentItem.id)) {
                  idsToExpand.push(currentItem.id);
              }
          }
      }

      // Update expanded items to exactly match the current path
      // This is the "Accordion" behavior: strictly path-based.
      setExpandedItems(new Set(idsToExpand));
    }
  }, [showTree, currentSlug, menu, findParentIds, findItemBySlug, findIdChainBySlugPath]);

  // Reset manual tab switch flag when navigating to new content
  useEffect(() => {
    if (currentSlug) {
      manualTabSwitchRef.current = false;
    }
  }, [currentSlug]);

  // Strict Accordion Logic:
  // When manually toggling an item, we ensure ONLY that path remains open.
  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      // If closing an item, just remove it
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      } 
      
      // If opening an item, find its path and collapse everything else (Accordion mode)
      // This satisfies the "Only with the folder of the current level expanded" requirement.
      const parents = findParentIds(menu, id) || [];
      const next = new Set([...parents, id]);
      return next;
    });
  };

  // --- Icons ---
  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'fyzika': return Atom;
      case 'chemie': return FlaskConical;
      case 'prirodopis': return Leaf;
      case 'matematika': 
      case 'matematika-1':
        return Calculator;
      case 'prvouka': return Sprout;
      default: return FileText;
    }
  };

  // --- Render Tree Item ---
  const renderMenuItem = (item: MenuItem, depth: number = 0, parentPath: string = '', isInsideWorkbooksTab: boolean = false) => {
    const hasChildren = item.children && item.children.length > 0;

    // Determine if folder should be compact (only contains files) or spacious (contains other folders)
    const containsSubfolders = item.children?.some(child => 
         child.type === 'group' || child.type === 'folder' || (child.children && child.children.length > 0)
    );
    const isCompactFolder = hasChildren && !containsSubfolders;

    const isExpanded = expandedItems.has(item.id);
    
    // Build full path for this item (used for navigation) - use id as fallback when slug is missing
    const itemSlugOrId = item.slug || item.id;
    const itemFullPath = parentPath ? `${parentPath}/${itemSlugOrId}` : itemSlugOrId;
    
    // Extract just the page slug from currentSlug for comparison (last segment)
    const currentPageSlug = currentSlug?.includes('/') ? currentSlug.split('/').pop() : currentSlug;
    
    // Simple active check - compare item slug with the page slug from URL
    const isActive = item.slug === currentPageSlug || normalize(item.slug) === normalize(currentPageSlug) || item.id === currentSlug;
    
    const isWorkbook = item.type === 'workbook' || item.icon === 'workbook' || item.icon === 'book';
    // Show thumbnails for workbook items in selection mode (not for pages inside workbook)
    const showThumbnail = isInsideWorkbooksTab && depth === 0 && !item.pageNumber;
    const isFolder = hasChildren || item.type === 'group' || !item.slug;
    // Determine Icon based on type (matching CategoryOverview/Filter)
    const getIconForType = (item: MenuItem) => {
        let type = item.type;
        const icon = item.icon;
        
        // Normalize legacy type/icon to standard types
        if (type === 'workbook' || icon === 'book' || icon === 'workbook') type = 'workbook';
        else if (type === 'worksheet' || icon === 'file-edit') type = 'worksheet';
        else if (type === 'textbook') type = 'textbook';
        else if (type === 'experiment') type = 'experiment';
        else if (type === 'test') type = 'test';
        else if (type === 'exam') type = 'exam';
        else if (type === 'methodology') type = 'methodology';
        else if (type === 'exercise' || type === 'practice') type = 'practice';
        else if ((!type && !hasChildren) || type === 'lesson' || type === 'document' || icon === 'message-square') type = 'lesson';

        const docType = DOCUMENT_TYPES.find(t => t.id === type);
        if (docType) return docType.icon;

        // Fallback for hardcoded legacy cases if any still slip through
        if (type === 'lesson') {
           const lessonType = DOCUMENT_TYPES.find(t => t.id === 'lesson');
           return lessonType ? lessonType.icon : FileText;
        }

        return FileText;
    };

    const Icon = getIconForType(item);

    // Build current path for navigation (reuse itemSlugOrId from above)
    const currentPath = itemFullPath;

    if (hasChildren || isFolder) {
       const showFolderBackground = depth === 0 && isExpanded;

       // Group children by type if expanded
       let groupedChildren: Record<string, MenuItem[]> = {};
       let sortedGroups: string[] = [];
       
       if (isExpanded && item.children) {
         // For workbooks, add page numbers to children based on their order
         const childrenWithPageNumbers = isWorkbook 
           ? item.children.map((child, index) => ({
               ...child,
               pageNumber: child.pageNumber || String(index + 1)
             }))
           : item.children;
           
         const groups = childrenWithPageNumbers.reduce((acc, child) => {
            let type = child.type;
            
            // Detect if it's a folder structure (even if empty)
            // A folder typically has type='group', type='folder', or children array exists (even if empty)
            const isFolder = child.type === 'group' || child.type === 'folder' || Array.isArray(child.children);

            // Normalize types
            if (type === 'workbook' || child.icon === 'book' || child.icon === 'workbook') type = 'workbook';
            else if (type === 'worksheet' || child.icon === 'file-edit') type = 'worksheet';
            else if (type === 'textbook') type = 'textbook';
            else if (type === 'experiment') type = 'experiment';
            else if (type === 'methodology') type = 'methodology';
            else if (type === 'test') type = 'test';
            else if (type === 'exam') type = 'exam';
            else if (type === 'exercise' || type === 'practice') type = 'practice';
            else if (isFolder) type = 'folder'; // Prioritize folder detection if explicitly folder-like
            else if ((!type) || type === 'lesson' || type === 'document' || child.icon === 'message-square') type = 'lesson';

            if (!type) type = 'lesson'; // Fallback safety

            if (!acc[type]) acc[type] = [];
            acc[type].push(child);
            return acc;
         }, {} as Record<string, MenuItem[]>);

         groupedChildren = groups;
         
         // Define Sort Order
         const sortOrder = [
            'folder', // Folders first (or maybe last? User image shows folders mixed or separate? Image shows "Lekce", "Pracovní listy". Folders usually go first or last. Let's put subfolders first or integrate them.)
            // Actually user image shows "Základy" -> "Hmota" -> "Částice hmoty" (Folder) -> Then list of files grouped by type
            // So inside "Částice hmoty":
            // Lekce: ...
            // Pracovní listy: ...
            'textbook', 
            'lesson', 
            'worksheet', 
            'experiment', 
            'methodology', 
            'practice', 
            'test', 
            'exam'
         ];
         
         sortedGroups = Object.keys(groups).sort((a, b) => {
            const indexA = sortOrder.indexOf(a);
            const indexB = sortOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
         });
       }

       return (
        <div 
          key={item.id}
          className={`transition-all duration-300 rounded-2xl ${showFolderBackground ? 'bg-[#F7F9FC] pb-1 mb-1' : ''}`}
        >
            <div
              className={`flex items-center gap-2 px-3 ${isWorkbook ? 'py-3 mb-2' : (isFolder ? 'py-2.5 mb-1' : (isCompactFolder ? 'py-1 mb-0.5' : 'py-2 mb-1'))} cursor-pointer rounded-xl transition-colors group select-none ${isActive ? 'nav-item-active' : ''}`}
              style={{ 
                paddingLeft: `${0.75 + depth * 0.5}rem`,
                color: isActive ? '#1e1b4b' : (isWorkbook ? '#3730a3' : '#4E5871'),
                fontSize: isWorkbook ? '1.05rem' : '1rem',
                backgroundColor: isWorkbook 
                  ? '#eef2ff' 
                  : (isActive && !showFolderBackground ? '#F1F4F9' : 'transparent')
              }}
              onClick={() => {
                  manualTabSwitchRef.current = true;
                  toggleExpanded(item.id);
                  
                  // Don't force tab switch. User is clicking on an item visible in current view.
                  // Keeping the current tab context prevents items from disappearing.

                  // Navigate in main panel using FULL PATH (always for folders)
                  console.log('[NAV] Folder clicked:', item.label, 'currentPath:', currentPath, 'activeCategory:', activeCategory);
                  if (currentPath) {
                      const targetUrl = `/docs/${activeCategory}/${currentPath}`;
                      console.log('[NAV] Navigating to:', targetUrl);
                      navigate(targetUrl);
                      if (onNavigate) onNavigate();
                  } else {
                      console.log('[NAV] currentPath is empty, not navigating');
                  }
              }}
            >
              {/* Chevron Button */}
              <div 
                className="p-1 -ml-1 rounded-md hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(item.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className={`${isWorkbook ? 'h-4 w-4' : 'h-3.5 w-3.5'} flex-shrink-0`} />
                ) : (
                  <ChevronRight className={`${isWorkbook ? 'h-4 w-4' : 'h-3.5 w-3.5'} flex-shrink-0`} />
                )}
              </div>

              {isWorkbook ? (
                item.coverImage ? (
                  <div className="w-12 h-16 flex-shrink-0 rounded-sm overflow-hidden shadow-md border border-white/30">
                    <img 
                      src={item.coverImage} 
                      alt={item.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-16 flex-shrink-0 rounded-sm bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-md">
                    <Book className="h-6 w-6 text-white/80" />
                  </div>
                )
              ) : (
                <Folder 
                  className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-indigo-900' : ''}`}
                  style={{ 
                    color: isActive ? '#1e1b4b' : (item.color || '#94a3b8'),
                    fill: isActive ? 'currentColor' : (item.color ? `${item.color}20` : 'transparent'),
                    fillOpacity: isActive ? 0.1 : 1
                  }} 
                />
              )}

              <span className={`truncate ${isActive ? 'text-[#1e1b4b]' : ''} ${isWorkbook ? 'font-medium' : 'font-normal'}`}>{item.label}</span>
            </div>
            
            {/* Only render children if expanded in state */}
            {isExpanded && (
              <div className={`relative ${depth > 0 ? 'ml-2 border-l border-slate-100' : ''}`}>
                {item.children && item.children.length > 0 ? (
                   sortedGroups.map(type => {
                      const groupItems = groupedChildren[type];
                      if (!groupItems || groupItems.length === 0) return null;
                      
                      // Map type to label
                      const typeLabels: Record<string, string> = {
                         'lesson': 'Lekce',
                         'worksheet': 'Pracovní listy',
                         'textbook': 'Učební texty',
                         'experiment': 'Experimenty',
                         'methodology': 'Metodika',
                         'test': 'Testy',
                         'exam': 'Písemky',
                         'practice': 'Procvičování',
                         'folder': 'Složky',
                         'workbook': 'Pracovní sešity'
                      };

                      // Only show header if it's not a folder group (folders usually look like folders) 
                      // OR if user specifically wants headers for everything. 
                      // User image shows headers for files. Subfolders (Látky a tělesa) are just listed.
                      // So let's show headers for file types, but maybe not for 'folder' type unless strictly requested.
                      // Actually image shows "Látky a tělesa" (Folder) at bottom without "Složky" header.
                      const showHeader = type !== 'folder';

                      return (
                         <div key={type} className="mb-1">
                            {showHeader && (
                               <div 
                                 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 px-3 mt-1"
                                 style={{ paddingLeft: `${0.75 + (depth + 1) * 0.5}rem` }}
                               >
                                  {typeLabels[type] || type}
                               </div>
                            )}
                            {groupItems.map(child => renderMenuItem(child, depth + 1, currentPath, isInsideWorkbooksTab))}
                         </div>
                      );
                   })
                ) : (
                   <div className="pl-8 py-1 text-xs text-slate-400">Prázdná složka</div>
                )}
              </div>
            )}
        </div>
       );
    }

    // Check for board types (practice, test, exam) - they should open in quiz viewer
    const boardTypes = ['practice', 'test', 'exam'];
    const isBoardType = boardTypes.includes(item.type || '');
    const hasBoardUrl = item.externalUrl?.startsWith('board://');
    const isBoard = isBoardType || hasBoardUrl;
    
    // Check for external link (non-board external URLs)
    const isExternalLink = item.externalUrl && !item.externalUrl.startsWith('board://');

    // Check if this item is inside a workbook (has pageNumber)
    const isInWorkbook = !!item.pageNumber;

    // Handle boards - navigate to quiz viewer
    if (isBoard) {
       // Determine board ID
       let boardId = '';
       if (hasBoardUrl) {
         boardId = item.externalUrl!.replace('board://', '');
       } else if (item.slug) {
         boardId = `board_${item.slug}`;
       }
       
       // Extract topic from parent path (first folder name after subject)
       // e.g. "zaklady/hmota" -> "zaklady", "sily" -> "sily"
       const topicSlug = parentPath.split('/')[0] || '';
       
       return (
          <div key={item.id}>
              <div
                className={`flex items-center gap-2.5 px-3 ${showThumbnail ? 'py-2' : 'py-1.5'} rounded-lg transition-colors mb-0.5 cursor-pointer ${isActive ? 'nav-item-active' : ''}`}
                style={{ 
                  paddingLeft: `${0.75 + (depth + 1) * 0.5}rem`,
                  color: '#4E5871',
                  backgroundColor: isActive ? '#F1F4F9' : 'transparent',
                  fontSize: '1rem'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (boardId) {
                    // Pass topic and subject as URL params for folder structure
                    const urlParams = new URLSearchParams();
                    if (topicSlug) urlParams.set('topic', topicSlug);
                    urlParams.set('subject', activeCategory);
                    navigate(`/quiz/view/${boardId}?${urlParams.toString()}`);
                    if (onNavigate) onNavigate();
                  }
                }}
              >
                {showThumbnail ? (
                  // Show thumbnail for top-level items in workbooks tab
                  item.coverImage ? (
                    <div className="w-8 h-11 flex-shrink-0 rounded-sm overflow-hidden shadow-sm border border-slate-200/50">
                      <img 
                        src={item.coverImage} 
                        alt={item.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`w-8 h-11 flex-shrink-0 rounded-sm flex items-center justify-center shadow-sm ${
                      isActive ? 'bg-indigo-500' : 'bg-gradient-to-br from-slate-300 to-slate-400'
                    }`}>
                      <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-white/90'}`}>
                        {item.pageNumber || '?'}
                      </span>
                    </div>
                  )
                ) : isInWorkbook ? (
                  // Show page number pill for items inside workbook
                  <span 
                    className={`min-w-[32px] h-8 px-2.5 rounded-xl text-sm font-bold flex items-center justify-center flex-shrink-0 ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {item.pageNumber || '?'}
                  </span>
                ) : (
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                )}
                <span className={`truncate flex-1 ${isActive ? 'text-slate-900 font-semibold' : 'font-normal'}`}>{item.label}</span>
              </div>
          </div>
       );
    }

    // Handle external links (non-board)
    if (isExternalLink) {
       return (
          <div key={item.id}>
              <a
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2.5 px-3 ${showThumbnail ? 'py-2' : 'py-1.5'} rounded-lg transition-colors mb-0.5 ${isActive ? 'nav-item-active' : ''}`}
                style={{ 
                  paddingLeft: `${0.75 + (depth + 1) * 0.5}rem`,
                  color: '#4E5871',
                  backgroundColor: isActive ? '#F1F4F9' : 'transparent',
                  fontSize: '1rem'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className={`truncate flex-1 ${isActive ? 'text-slate-900 font-semibold' : 'font-normal'}`}>{item.label}</span>
              </a>
          </div>
       );
    }

    return (
      <div key={item.id}>
          <Link
            to={`/docs/${activeCategory}/${currentPath}`}
            className={`flex items-center gap-2.5 px-3 ${showThumbnail ? 'py-2' : 'py-1.5'} rounded-lg transition-colors mb-0.5 ${isActive ? 'nav-item-active' : ''}`}
            style={{ 
              paddingLeft: `${0.75 + (depth + 1) * 0.5}rem`,
              color: '#4E5871',
              backgroundColor: isActive ? '#F1F4F9' : 'transparent',
              fontSize: '1rem'
            }}
            onClick={(e) => {
              manualTabSwitchRef.current = true;
              // Don't force tab switch.
              if (onNavigate) onNavigate();
            }}
          >
            {showThumbnail ? (
              // Show thumbnail for top-level items in workbooks tab
              item.coverImage ? (
                <div className="w-8 h-11 flex-shrink-0 rounded-sm overflow-hidden shadow-sm border border-slate-200/50">
                  <img 
                    src={item.coverImage} 
                    alt={item.label}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`w-8 h-11 flex-shrink-0 rounded-sm flex items-center justify-center shadow-sm ${
                  isActive ? 'bg-indigo-500' : 'bg-gradient-to-br from-slate-300 to-slate-400'
                }`}>
                  <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-white/90'}`}>
                    {item.pageNumber || '?'}
                  </span>
                </div>
              )
            ) : isInWorkbook ? (
              // Show page number pill for items inside workbook
              <span 
                className={`min-w-[32px] h-8 px-2.5 rounded-xl text-sm font-bold flex items-center justify-center flex-shrink-0 ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {item.pageNumber || '?'}
              </span>
            ) : (
            <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            )}
            <span className={`truncate flex-1 ${isActive ? 'text-slate-900 font-semibold' : 'font-normal'}`}>{item.label}</span>
          </Link>
      </div>
    );
  };

  // 1. TREE VIEW
  if (showTree) {
     // Filter menu based on active tab
     const workbooksMenu = menu.filter(item => {
        const isWorkbook = item.type === 'workbook' || item.icon === 'workbook' || item.icon === 'book';
        return isWorkbook;
     });
     
     const foldersMenu = menu.filter(item => {
        const isWorkbook = item.type === 'workbook' || item.icon === 'workbook' || item.icon === 'book';
        return !isWorkbook;
     });
     
     // Derived "focused folder" mode:
     // If the URL (`currentSlug`) points inside a top-level folder, we show ONLY that folder
     // (even if local state hasn't been toggled yet).
     const topFolderFromSlug =
       activeTab === 'folders' && currentSlug
         ? findTopLevelFolderForSlug(foldersMenu, currentSlug)
         : null;
     const focusedTopLevelFolder = topFolderFromSlug || currentTopLevelFolder;
     const isInFocusedFolderView =
       activeTab === 'folders' && !!focusedTopLevelFolder && (!!topFolderFromSlug || !folderSelectionMode);

     // Find current workbook if we're inside one
     const currentWorkbook = activeTab === 'workbooks' ? findCurrentWorkbook(menu, currentSlug || '') : null;
     
     // Determine what to show in workbooks tab
     const showWorkbookContent = activeTab === 'workbooks' && currentWorkbook && !workbookSelectionMode;
     
    return (
       <nav className="h-full overflow-y-auto bg-[#EAEFFA]">
          {/* Back to Library Link */}
          <div className="px-4 pt-4">
            <button
              onClick={() => navigate('/docs')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-indigo-600 hover:bg-white/50 rounded-xl transition-all w-full group"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-indigo-500/10 flex items-center justify-center transition-colors">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <span className="font-bold uppercase tracking-wider text-[10px]">Knihovna</span>
            </button>
          </div>

          {/* Header with category name */}
          <div className="p-4 pt-2">
              <div className="font-bold text-2xl text-[#4E5871] capitalize px-1 text-center">
                 {activeCategory.replace('-', ' ')}
              </div>
           </div>

           {/* Switcher */}
           <div className="px-4 pb-4">
              <div className="flex p-1.5 bg-slate-200/40 rounded-xl border border-slate-200/60">
                <button
                  onClick={() => {
                    if (!canViewFolders) return;
                    manualTabSwitchRef.current = true;
                    setWorkbookSelectionMode(true);
                    // If already on folders tab and in folder view, go back to selection
                    if (activeTab === 'folders' && isInFocusedFolderView) {
                      setFolderSelectionMode(true);
                      setCurrentTopLevelFolder(null);
                      navigate(`/docs/${activeCategory}`);
                      if (onNavigate) onNavigate();
                    } else {
                      setFolderSelectionMode(true);
                      setCurrentTopLevelFolder(null);
                      onTabChange('folders');
                    }
                  }}
                  disabled={!canViewFolders}
                  title={!canViewFolders ? 'Zobrazení složek vyžaduje Rozšířený digitální přístup' : undefined}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    !canViewFolders
                      ? 'text-slate-300 cursor-not-allowed'
                      : activeTab === 'folders' 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  }`}
                >
                  <LayoutGrid className="h-5 w-5" />
                  Složky
                </button>
                <button
                  onClick={() => {
                    manualTabSwitchRef.current = true;
                    setWorkbookSelectionMode(true);
                    setFolderSelectionMode(true);
                    setCurrentTopLevelFolder(null);
                    onTabChange('workbooks');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    activeTab === 'workbooks' 
                      ? 'bg-white text-indigo-700 shadow-sm' 
                      : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                  }`}
                >
                   <svg viewBox="0 0 37 33" className="h-5 w-5" fill="currentColor" preserveAspectRatio="xMidYMid meet">
                      <path d="M34.2 15.7C34.4 15.2 34.7 14.4 34.2 13.4C34.2 13.3 34.2 13.2 34.2 13.2L28.1 2.9C27.4 1.9 26.4 1.5 25 1.5C23.6 1.5 24.3 1.5 24 1.5C20.6 1.8 17.2 3.7 15.1 6.3C15.1 6.4 14.9 6.5 14.9 6.7C14.5 6.5 14 6.5 13.7 6.4C13.7 6.4 13.7 6.4 13.6 6.4C13.1 6.4 12.5 6.3 11.9 6.3C11.6 6.3 11.2 6.3 10.9 6.3C8.2 6.5 5.6 7.6 3.4 9.5C3.4 9.5 3.4 9.5 3.3 9.6C3 9.9 2.6 10.2 2.3 10.6C1.6 11.5 1.6 12.3 1.7 12.9V13.1L1.8 13.3L2.1 13.9C1.8 14.1 1.6 14.5 1.6 14.8C1.6 14.8 1.6 14.9 1.6 15L8.7 29.8C9 30.3 9.4 30.6 10 30.5C10.4 30.5 11.6 29.2 12 28.8C14.6 26.7 18 25.7 21.3 25.8C21.4 25.8 21.5 25.8 21.6 25.8C21.6 25.8 21.8 25.8 21.9 25.8C21.9 25.8 21.9 25.8 22 25.8C22.2 25.8 22.4 25.8 22.6 25.8C22.7 25.8 22.8 25.8 23 25.8C23.5 25.9 24 25.1 24.3 24.8C26.1 23.2 28.6 22.5 30.9 22.3C31.5 22.3 32.9 22.5 32.7 21.4C32.7 21.1 31.4 19.4 31.5 19.3C31.9 19.1 33.6 19.3 33.9 19.1C33.9 19.1 34.1 18.8 34.1 18.3C34.1 17.9 33.6 17.2 33.2 16.7C33.6 16.5 33.9 16.2 34.2 15.7ZM4.4 10.7C6.2 9.1 8.5 8.1 10.9 8C11.2 8 11.5 8 11.7 8C12.2 8 12.7 8 13.2 8C13.7 8 14.3 8.1 14.6 8.5L21.4 21.8C21.4 21.8 21.4 21.9 21.4 22C21.4 22.3 21.4 22.5 21 22.5C20.2 22.5 19.2 22.2 18.3 22.1C18 22.1 17.7 22.1 17.4 22.1C15.3 22.1 13.1 22.5 11.3 23.5C10.7 23.8 10.1 24.4 9.5 24.4C8.9 24.4 9 24.3 8.8 24L3.2 12.4C3.2 12 3.3 11.7 3.6 11.4C3.8 11.1 4.1 10.9 4.4 10.7ZM30.6 15.8C28.4 16.5 26.3 18.1 24.7 19.7C24.2 20.2 24.2 20.7 23.8 21.1C23.7 21.2 23.6 21.3 23.5 21.3C23.4 21.3 23.4 21.3 23.3 21.3C22.9 20.7 16 7.6 16.3 7.2C18.1 4.9 21.1 3.3 24 3C24.3 3 24.6 3 24.9 3C25.6 3 26.2 3.1 26.6 3.7L32.7 14C32.8 14.3 32.8 14.5 32.7 14.7C32.5 15.4 31.3 15.5 30.5 15.7L30.6 15.8Z" />
                   </svg>
                   Sešity
                </button>
              </div>
           </div>

           {/* Tree Content */}
           <div className="p-2 pb-20">
              {loading ? (
                 <LoadingSpinner className="p-8" />
              ) : menu.length === 0 ? (
                 <div className="p-4 text-sm text-slate-400">Žádný obsah.</div>
  ) : activeTab === 'folders' && isInFocusedFolderView && focusedTopLevelFolder ? (
                 // FOLDERS TAB - inside a folder: show folder header + its content
                 <div className="space-y-2">
                    {/* Back to folder selection button */}
                    <button
                      onClick={() => {
                        setFolderSelectionMode(true);
                        setCurrentTopLevelFolder(null);
                        navigate(`/docs/${activeCategory}`);
                        if (onNavigate) onNavigate();
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors w-full"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Zpět na výběr témat</span>
                    </button>
                    
                    {/* Current folder header */}
                    <div 
                      className="flex items-center gap-3 px-3 py-3 bg-white rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        const folderPath = focusedTopLevelFolder.slug || focusedTopLevelFolder.id;
                        if (folderPath) {
                          navigate(`/docs/${activeCategory}/${folderPath}`);
                          if (onNavigate) onNavigate();
                        }
                      }}
                    >
                      <Folder 
                        className="h-5 w-5 flex-shrink-0"
                        style={{ 
              color: focusedTopLevelFolder.color || '#94a3b8',
              fill: focusedTopLevelFolder.color ? `${focusedTopLevelFolder.color}20` : 'transparent'
                        }} 
                      />
          <span className="font-semibold text-slate-800">{focusedTopLevelFolder.label}</span>
                    </div>
                    
                    {/* Folder children */}
                    <div className="mt-2">
          {focusedTopLevelFolder.children?.map(child => 
            renderMenuItem(child, 0, focusedTopLevelFolder.slug || focusedTopLevelFolder.id, false)
                      )}
                    </div>
                 </div>
              ) : activeTab === 'folders' ? (
                 // FOLDERS TAB - selection mode: show all top-level folders
                 <div className="space-y-2">
                    {foldersMenu.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-3 cursor-pointer rounded-xl transition-colors hover:bg-white/60"
                        onClick={() => {
                          setFolderSelectionMode(false);
                          setCurrentTopLevelFolder(item);
                          if (item.slug) {
                            navigate(`/docs/${activeCategory}/${item.slug}`);
                            if (onNavigate) onNavigate();
                          }
                        }}
                      >
                        <Folder 
                          className="h-5 w-5 flex-shrink-0"
                          style={{ 
                            color: item.color || '#94a3b8',
                            fill: item.color ? `${item.color}20` : 'transparent'
                          }} 
                        />
                        <span className="font-medium text-slate-800">{item.label}</span>
                      </div>
                    ))}
                 </div>
              ) : showWorkbookContent && currentWorkbook ? (
                 // WORKBOOKS TAB - inside a workbook: show workbook header + its content
                 <div className="space-y-2">
                    {/* Back to workbooks selection button */}
                    <button
                      onClick={() => setWorkbookSelectionMode(true)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors w-full"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Zpět na výběr sešitů</span>
                    </button>
                    
                    {/* Current workbook header */}
                    <div className="flex items-center gap-3 px-3 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      {currentWorkbook.coverImage ? (
                        <div className="w-12 h-16 flex-shrink-0 rounded-sm overflow-hidden shadow-md border border-white/30">
                          <img 
                            src={currentWorkbook.coverImage} 
                            alt={currentWorkbook.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-16 flex-shrink-0 rounded-sm bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-md">
                          <Book className="h-6 w-6 text-white/80" />
                        </div>
                      )}
                      <span className="font-semibold text-indigo-900">{currentWorkbook.label}</span>
                    </div>
                    
                    {/* Workbook children (pages) */}
                    <div className="mt-2">
                      {currentWorkbook.children?.map((child, index) => {
                        const childWithPageNumber = { ...child, pageNumber: child.pageNumber || String(index + 1) };
                        return renderMenuItem(childWithPageNumber, 0, currentWorkbook.slug || '', true);
                      })}
                    </div>
                 </div>
              ) : (
                 // WORKBOOKS TAB - selection mode: show all workbooks without expansion
                 <div className="space-y-2">
                    {workbooksMenu.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-3 cursor-pointer rounded-xl transition-colors hover:bg-white/60"
                        onClick={() => {
                          setWorkbookSelectionMode(false);
                          if (item.slug) {
                            navigate(`/docs/${activeCategory}/${item.slug}`);
                            if (onNavigate) onNavigate();
                          }
                        }}
                      >
                        {item.coverImage ? (
                          <div className="w-12 h-16 flex-shrink-0 rounded-sm overflow-hidden shadow-md border border-white/30">
                            <img 
                              src={item.coverImage} 
                              alt={item.label}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-16 flex-shrink-0 rounded-sm bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-md">
                            <Book className="h-6 w-6 text-white/80" />
                          </div>
                        )}
                        <span className="font-medium text-slate-800">{item.label}</span>
                      </div>
                    ))}
                 </div>
              )}
           </div>
        </nav>
     );
  }

  // 2. CATEGORIES VIEW
  return (
    <nav className="p-4 flex flex-col h-full overflow-hidden rounded-[30px]">
      {/* View Switcher - moved to top */}
      {!hideTabSwitcher && (
        <div className="mb-6 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
            Zobrazení
          </div>
          <div className="flex p-1.5 bg-slate-200/40 rounded-xl border border-slate-200/60">
            <button
              onClick={() => {
                if (!canViewFolders) return;
                manualTabSwitchRef.current = true;
                onTabChange('folders');
              }}
              disabled={!canViewFolders}
              title={!canViewFolders ? 'Zobrazení složek vyžaduje Rozšířený digitální přístup' : undefined}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !canViewFolders
                  ? 'text-slate-300 cursor-not-allowed'
                  : activeTab === 'folders' 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <LayoutGrid className="h-5 w-5" />
              Složky
            </button>
            <button
              onClick={() => {
                manualTabSwitchRef.current = true;
                onTabChange('workbooks');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'workbooks' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
              }`}
            >
               <svg viewBox="0 0 37 33" className="h-5 w-5" fill="currentColor" preserveAspectRatio="xMidYMid meet">
                  <path d="M34.2 15.7C34.4 15.2 34.7 14.4 34.2 13.4C34.2 13.3 34.2 13.2 34.2 13.2L28.1 2.9C27.4 1.9 26.4 1.5 25 1.5C23.6 1.5 24.3 1.5 24 1.5C20.6 1.8 17.2 3.7 15.1 6.3C15.1 6.4 14.9 6.5 14.9 6.7C14.5 6.5 14 6.5 13.7 6.4C13.7 6.4 13.7 6.4 13.6 6.4C13.1 6.4 12.5 6.3 11.9 6.3C11.6 6.3 11.2 6.3 10.9 6.3C8.2 6.5 5.6 7.6 3.4 9.5C3.4 9.5 3.4 9.5 3.3 9.6C3 9.9 2.6 10.2 2.3 10.6C1.6 11.5 1.6 12.3 1.7 12.9V13.1L1.8 13.3L2.1 13.9C1.8 14.1 1.6 14.5 1.6 14.8C1.6 14.8 1.6 14.9 1.6 15L8.7 29.8C9 30.3 9.4 30.6 10 30.5C10.4 30.5 11.6 29.2 12 28.8C14.6 26.7 18 25.7 21.3 25.8C21.4 25.8 21.5 25.8 21.6 25.8C21.6 25.8 21.8 25.8 21.9 25.8C21.9 25.8 21.9 25.8 22 25.8C22.2 25.8 22.4 25.8 22.6 25.8C22.7 25.8 22.8 25.8 23 25.8C23.5 25.9 24 25.1 24.3 24.8C26.1 23.2 28.6 22.5 30.9 22.3C31.5 22.3 32.9 22.5 32.7 21.4C32.7 21.1 31.4 19.4 31.5 19.3C31.9 19.1 33.6 19.3 33.9 19.1C33.9 19.1 34.1 18.8 34.1 18.3C34.1 17.9 33.6 17.2 33.2 16.7C33.6 16.5 33.9 16.2 34.2 15.7ZM4.4 10.7C6.2 9.1 8.5 8.1 10.9 8C11.2 8 11.5 8 11.7 8C12.2 8 12.7 8 13.2 8C13.7 8 14.3 8.1 14.6 8.5L21.4 21.8C21.4 21.8 21.4 21.9 21.4 22C21.4 22.3 21.4 22.5 21 22.5C20.2 22.5 19.2 22.2 18.3 22.1C18 22.1 17.7 22.1 17.4 22.1C15.3 22.1 13.1 22.5 11.3 23.5C10.7 23.8 10.1 24.4 9.5 24.4C8.9 24.4 9 24.3 8.8 24L3.2 12.4C3.2 12 3.3 11.7 3.6 11.4C3.8 11.1 4.1 10.9 4.4 10.7ZM30.6 15.8C28.4 16.5 26.3 18.1 24.7 19.7C24.2 20.2 24.2 20.7 23.8 21.1C23.7 21.2 23.6 21.3 23.5 21.3C23.4 21.3 23.4 21.3 23.3 21.3C22.9 20.7 16 7.6 16.3 7.2C18.1 4.9 21.1 3.3 24 3C24.3 3 24.6 3 24.9 3C25.6 3 26.2 3.1 26.6 3.7L32.7 14C32.8 14.3 32.8 14.5 32.7 14.7C32.5 15.4 31.3 15.5 30.5 15.7L30.6 15.8Z" />
               </svg>
               Sešity
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-6">
        {groups?.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-1">
            {group.title && (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
                {group.title}
              </div>
            )}
            {group.items.map((cat) => {
              const Icon = getCategoryIcon(cat.id);
              const isActive = activeCategory === cat.id;
              
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    navigate(`/docs/${cat.id}`);
                    if (onNavigate) onNavigate();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] text-slate-900' 
                      : 'text-[#4E5871] hover:bg-white/60'
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'bg-white text-slate-400 group-hover:text-slate-600 border border-slate-100'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`font-medium text-[15px] tracking-wide ${isActive ? 'font-semibold' : ''}`} style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                    {cat.label}
                  </span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
