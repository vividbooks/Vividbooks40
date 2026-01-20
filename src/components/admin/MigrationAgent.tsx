/**
 * Migration Agent
 * 
 * Tool for migrating content from old Vividbooks API to the new library system.
 * Fetches books, chapters, and knowledge items from the legacy API and imports them.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  BookOpen, 
  ChevronRight, 
  ChevronDown,
  Download, 
  Check, 
  X, 
  Loader2,
  RefreshCw,
  Eye,
  FileText,
  Video,
  Image as ImageIcon,
  Folder,
  FolderOpen,
  Play,
  AlertCircle,
  CheckCircle2,
  Search,
  Settings,
  Upload,
  Sparkles,
  Film
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import * as pdfjsLib from 'pdfjs-dist';
import { importBoardFromLegacy, extractBoardId, isImportableBoardUrl } from '../../utils/board-import';
import { saveQuiz } from '../../utils/quiz-storage';
import { createEmptyQuiz } from '../../types/quiz';

// Configure PDF.js worker
// Set worker path for PDF.js - Using a consistent and reliable CDN URL
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

/**
 * Utility to get current session reliably, trying localStorage first
 * then falling back to Supabase API with a timeout to prevent hanging.
 */
async function getSupabaseSession() {
  // Method 1: Try localStorage
  try {
    const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token) {
        console.log('[Auth] Got token from localStorage');
        return {
          data: {
            session: {
              access_token: parsed.access_token,
              user: parsed.user
            }
          },
          error: null
        };
      }
    }
  } catch (e) {
    console.error('[Auth] Error reading from localStorage:', e);
  }

  // Method 2: Fallback to getSession with timeout
  try {
    const sessionPromise = getSupabaseSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session timeout')), 3000)
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
    console.log('[Auth] Got session from API:', result?.data?.session ? 'yes' : 'no');
    return {
      data: { session: result?.data?.session || null },
      error: result?.error || null
    };
  } catch (e) {
    console.error('[Auth] Session fetch failed/timeout:', e);
    return { data: { session: null }, error: e };
  }
}

// =============================================
// TYPES
// =============================================

interface LegacySubject {
  id: number;
  name: string;
  description: string;
  isBought: boolean;
}

interface LegacyAnimation {
  type: string;
  audioUrl?: string;
  introAnimationUrl?: string;
  items?: Array<{
    id: number;
    animationUrl: string;
    audioUrl?: string;
    isLoop: boolean;
    type?: string;
  }>;
}

interface LegacyDocument {
  id: number;
  type: string;
  createdAt: string;
  previewUrl?: string;
  documentUrl: string;
  name: string;
  isCreatedByTeacher?: boolean;
  containsCorrectAnswers?: boolean;
}

interface LegacyKnowledge {
  id: number;
  name: string;
  description: string;
  imageUrl?: string;
  referenceImageUrl?: string;
  target2DImageUrl?: string;
  isDemo?: boolean;
  animation?: LegacyAnimation;
  practices?: any[];
  tests?: any[];
  abcdTests?: any[];
  minigames?: any[];
  bonusSheets?: any[];
  createdByTeacher?: boolean;
  disabled?: boolean;
  languageCode?: string;
  solutionUrl?: string;
  textbookId?: string;
  methodicPdf?: string;
  // Additional content sections
  questions?: string;
  answers?: string;
  methodicalInspiration?: string;
  conclusion?: string;
  pdfUrl?: string;
  extendedPdfUrl?: string;
  methodicalInspirationPdfUrl?: string;
  documents?: LegacyDocument[];
  relatedKnowledge?: any[];
  isRvp?: boolean;
  methodicsOnly?: boolean;
  relatedKnowledgeIds?: number[];
  lessonsAndExperiments?: any[];
  relatedQuizzes?: any[];
}

// Content block document (worksheet) from contentBlocks
interface LegacyContentBlockDocument {
  id: number;
  name: string;
  documentUrl: string;
  previewUrl?: string;
  createdAt: string;
  type: string; // 'worksheet', 'methodical_inspiration', etc.
  containsCorrectAnswers: boolean;
  isRvp: boolean;
  solutionUrl?: string;
  textbookId?: string;
  languageCode?: string;
  methodicPdf?: LegacyContentBlockDocument;
  interactiveWorksheets?: Array<{
    externalId: string;
    name: string;
    url: string;
    contentType: string;
    playableLink?: string;
  }>;
  practices?: Array<{
    externalId: string;
    name: string;
    url: string;
    imageUrl?: string;
    level?: number;
    playableLink?: string;
  }>;
  tests?: any[];
  abcdTests?: any[];
  minigames?: any[];
}

// Content block from contentBlocks array (different from knowledge)
interface LegacyContentBlock {
  id: number;
  name: string;
  content: string; // HTML content (učební text)
  imageUrl?: string;
  isRvp: boolean;
  publicContent?: string;
  titles?: string[];
  contentImages?: string[];
  documents: LegacyContentBlockDocument[];
  experimentsPdf?: any[];
  methodicalInspirationsPdf?: LegacyContentBlockDocument[];
  animationData?: any[];
  pdfUrl?: string;
  textbookPdfUrl?: string;
  relatedQuizzes?: any[];
}

interface LegacyChapter {
  id: number;
  name: string;
  knowledge: LegacyKnowledge[];
  contentBlocks?: LegacyContentBlock[]; // Worksheets-only chapters have this instead of knowledge
  imageUrl?: string;
  pdfUrl?: string;
  methodicalInspirationPdfUrl?: string;
}

interface LegacyBook {
  id: number;
  name: string;
  description: string;
  authors: string;
  subject: LegacySubject;
  chapters: LegacyChapter[];
  imageUrl?: string;
  pdfUrl?: string;
  eshopUrl?: string;
}

interface WorkbookBonus {
  id: string;
  label: string;
  url: string;
  type: 'pdf' | 'link';
}

interface ImportStatus {
  id: string;
  type: 'book' | 'chapter' | 'knowledge';
  name: string;
  status: 'pending' | 'importing' | 'success' | 'error';
  error?: string;
}

interface WorksheetLink {
  label: string;
  url?: string;
  itemId?: string;
}

interface ExtendedWorksheetData {
  isExtended?: boolean;
  solutionPdf?: WorksheetLink;
  interactive?: WorksheetLink[];
  textbook?: WorksheetLink;
  methodology?: WorksheetLink;
  practice?: WorksheetLink[];
  minigames?: WorksheetLink[];
  tests?: WorksheetLink[];
  exams?: WorksheetLink[];
  bonuses?: WorksheetLink[];
}

interface WorkbookPage {
  id: string;
  pageNumber: number;
  worksheetId: string;
  worksheetSlug: string;
  worksheetLabel: string;
  worksheetCover?: string;
}

interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  type?: string;
  icon?: string;
  coverImage?: string;
  children?: MenuItem[];
  url?: string;
  extendedWorksheet?: ExtendedWorksheetData;
  workbookPages?: WorkbookPage[];
  author?: string;
  eshopUrl?: string;
  bonuses?: WorkbookBonus[];
}

// =============================================
// STORAGE BUCKET FOR MIGRATIONS
// =============================================

// Use existing teacher-files bucket for migrations
const MIGRATION_STORAGE_BUCKET = 'teacher-files';

/**
 * Download a file from external URL and upload to Supabase storage
 * Returns the new Supabase storage URL or null on failure
 */
async function downloadAndUploadFile(
  externalUrl: string,
  fileName: string,
  folder: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log(`[Migration] Downloading: ${externalUrl}`);
    
    // Skip if URL is already from our storage
    if (externalUrl.includes('supabase.co/storage')) {
      console.log(`[Migration] Skipping - already in Supabase storage`);
      return externalUrl;
    }
    
    // Try to fetch the file from external URL
    // Use no-cors mode as fallback if regular fetch fails
    let response: Response;
    try {
      response = await fetch(externalUrl, {
        mode: 'cors',
        credentials: 'omit',
      });
    } catch (corsError) {
      console.warn(`[Migration] CORS error, trying proxy approach:`, corsError);
      // If CORS fails, we can't download directly - return original URL
      return null;
    }
    
    if (!response.ok) {
      console.error(`[Migration] Failed to download: ${response.status}`);
      return null;
    }
    
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Skip very small responses (likely error pages)
    if (blob.size < 100) {
      console.warn(`[Migration] File too small (${blob.size} bytes), skipping`);
      return null;
    }
    
    // Generate unique file path with migrations prefix
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `migrations/${folder}/${timestamp}_${safeName}`;
    
    console.log(`[Migration] Uploading to: ${filePath} (${blob.size} bytes)`);
    
    // Upload to Supabase Storage using direct REST API to avoid getSession() hanging
    try {
      const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
      const stored = localStorage.getItem(storageKey);
      const token = stored ? JSON.parse(stored)?.access_token : null;
      
      if (!token) {
        console.error('[Migration] No token for storage upload');
        return null;
      }
      
      const uploadUrl = `https://njbtqmsxbyvpwigfceke.supabase.co/storage/v1/object/${MIGRATION_STORAGE_BUCKET}/${filePath}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
          'Cache-Control': '31536000',
        },
        body: blob,
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`[Migration] Upload error: ${uploadResponse.status}`, errorText);
        return null;
      }
      
      console.log(`[Migration] Upload successful: ${filePath}`);
    } catch (err) {
      console.error(`[Migration] Upload exception:`, err);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(MIGRATION_STORAGE_BUCKET)
      .getPublicUrl(filePath);
    
    console.log(`[Migration] Uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (err) {
    console.error(`[Migration] Error downloading/uploading file:`, err);
    return null;
  }
}

/**
 * Generate a thumbnail/preview image from the first page of a PDF
 * Returns the uploaded image URL or null on failure
 */
async function generatePdfPreview(
  pdfUrl: string,
  folder: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log(`[Migration] Generating PDF preview for: ${pdfUrl}`);
    
    // Load the PDF
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      // Disable worker for simpler setup
      disableAutoFetch: true,
      disableStream: true,
    });
    
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Get first page
    
    // Set scale for good quality thumbnail
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('[Migration] Could not get canvas context');
      return null;
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport,
    }).promise;
    
    // Convert canvas to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });
    
    if (!blob) {
      console.error('[Migration] Could not convert canvas to blob');
      return null;
    }
    
    console.log(`[Migration] PDF preview generated: ${blob.size} bytes`);
    
    // Upload to Supabase Storage
    const timestamp = Date.now();
    const filePath = `migrations/${folder}/pdf_preview_${timestamp}.jpg`;
    
    // Upload using direct REST API to avoid getSession() hanging
    try {
      const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
      const stored = localStorage.getItem(storageKey);
      const token = stored ? JSON.parse(stored)?.access_token : null;
      
      if (!token) {
        console.error('[Migration] No token for PDF preview upload');
        return null;
      }
      
      const uploadUrl = `https://njbtqmsxbyvpwigfceke.supabase.co/storage/v1/object/${MIGRATION_STORAGE_BUCKET}/${filePath}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'false',
          'Cache-Control': '31536000',
        },
        body: blob,
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`[Migration] PDF preview upload error: ${uploadResponse.status}`, errorText);
        return null;
      }
      
      console.log(`[Migration] PDF preview upload successful: ${filePath}`);
    } catch (err) {
      console.error(`[Migration] PDF preview upload exception:`, err);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(MIGRATION_STORAGE_BUCKET)
      .getPublicUrl(filePath);
    
    console.log(`[Migration] PDF preview uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (err) {
    console.error(`[Migration] Error generating PDF preview:`, err);
    return null;
  }
}

/**
 * Get file extension from URL
 */
function getFileExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    return ext.split('?')[0]; // Remove query params
  } catch {
    return '';
  }
}

/**
 * Get file name from URL
 */
function getFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').pop() || 'file';
  } catch {
    return 'file';
  }
}

// =============================================
// COMPONENT
// =============================================

export function MigrationAgent() {
  const navigate = useNavigate();
  
  // API Config
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.vividbooks.com/v1');
  const [userCode, setUserCode] = useState('pascal');
  
  // Data State
  const [bookIds, setBookIds] = useState<string>('44'); // Comma-separated book IDs to fetch
  const [books, setBooks] = useState<LegacyBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection State
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Import State
  const [importing, setImporting] = useState(false);
  const [importStatuses, setImportStatuses] = useState<ImportStatus[]>([]);
  const [targetCategory, setTargetCategory] = useState('fyzika');
  const [downloadFiles, setDownloadFiles] = useState(true); // Download PDFs, images, Lottie to our storage
  const [overwriteExisting, setOverwriteExisting] = useState(false); // Overwrite existing pages with same slug
  
  // Menu Structure State
  const [menuStructure, setMenuStructure] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null); // null = root, or menu item id
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [expandedMenuItems, setExpandedMenuItems] = useState<Set<string>>(new Set());
  
  // Preview State
  const [previewItem, setPreviewItem] = useState<LegacyKnowledge | null>(null);
  const [previewContext, setPreviewContext] = useState<{
    chapter?: LegacyChapter;
    book?: LegacyBook;
  } | null>(null);
  
  // Asset Extraction State
  const [extractingAssets, setExtractingAssets] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{
    total: number;
    processed: number;
    saved: number;
    errors: number;
    currentPage?: string;
  } | null>(null);
  const [extractedAssets, setExtractedAssets] = useState<Array<{
    name: string;
    url: string;
    category: string;
    type: 'animation' | 'image';
    pageSlug: string;
    stepIndex?: number;
  }>>([]);

  // =============================================
  // ASSET SAVING - Save animations to vividbooks_assets during migration
  // =============================================

  /**
   * Save a single animation/image to vividbooks_assets table
   * Called automatically during lesson migration
   * Silently skips if table doesn't exist (not blocking migration)
   */
  // Flag to track if vividbooks_assets table exists (skip all saves if not)
  const [assetTableExists, setAssetTableExists] = useState<boolean | null>(null);
  
  const saveAssetToDatabase = async (asset: {
    name: string;
    url: string;
    category: string;
    type: 'animation' | 'image';
    lessonName: string;
    lessonSlug: string;
    stepIndex?: number;
    isIntro?: boolean;
    thumbnailUrl?: string;
    tags?: string[];
  }): Promise<boolean> => {
    // Skip if we already know table doesn't exist
    if (assetTableExists === false) {
      return false;
    }
    
    try {
      // Use timeout to prevent blocking migration
      const timeoutPromise = new Promise<{ data: null; error: { code: string } }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: { code: 'TIMEOUT' } }), 3000)
      );
      
      // Check if asset already exists (by URL)
      const queryPromise = supabase
        .from('vividbooks_assets')
        .select('id')
        .eq('file_url', asset.url)
        .maybeSingle();
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data: existing, error: checkError } = result as any;
      
      // If table doesn't exist or timeout, skip silently
      if (checkError?.code === 'PGRST205' || checkError?.code === '42P01') {
        console.log('[Migration] Asset table does not exist, skipping asset saves');
        setAssetTableExists(false);
        return false;
      }
      
      if (checkError?.code === 'TIMEOUT') {
        console.log('[Migration] Asset save timed out, skipping');
        return false;
      }
      
      if (existing) {
        return true;
      }
      
      // Build tags from lesson info
      const tags = [
        asset.lessonName,
        asset.category,
        asset.type === 'animation' ? 'lottie' : 'image',
        asset.isIntro ? 'intro' : null,
        asset.stepIndex !== undefined ? `krok-${asset.stepIndex + 1}` : null,
        ...(asset.tags || [])
      ].filter(Boolean);
      
      // Insert new asset with timeout
      const insertTimeoutPromise = new Promise<{ error: { code: string } }>((resolve) => 
        setTimeout(() => resolve({ error: { code: 'TIMEOUT' } }), 3000)
      );
      
      const insertQueryPromise = supabase
        .from('vividbooks_assets')
        .insert({
          name: asset.name,
          description: `Animace z lekce "${asset.lessonName}"`,
          asset_type: asset.type,
          file_url: asset.url,
          thumbnail_url: asset.thumbnailUrl,
          category: asset.category,
          tags: tags,
          license_required: true,
          license_tier: 'basic',
          is_active: true
        });
      
      const insertResult = await Promise.race([insertQueryPromise, insertTimeoutPromise]);
      const { error: insertError } = insertResult as any;
      
      // If table doesn't exist or timeout, skip silently
      if (insertError?.code === 'PGRST205' || insertError?.code === '42P01') {
        setAssetTableExists(false);
        return false;
      }
      
      if (insertError?.code === 'TIMEOUT') {
        return false;
      }
      
      if (insertError) {
        console.error('[Migration] Error saving asset:', insertError.message);
        return false;
      }
      
      setAssetTableExists(true);
      return true;
    } catch (err) {
      console.error('[Migration] Error saving asset:', err);
      return false;
    }
  };

  // =============================================
  // ASSET EXTRACTION - Extract Lottie animations from migrated pages (for existing pages)
  // =============================================

  interface ExtractedAssetData {
    name: string;
    url: string;
    category: string;
    type: 'animation' | 'image';
    pageSlug: string;
    pageTitle: string;
    stepIndex?: number;
    isIntro?: boolean;
    thumbnailUrl?: string;
  }

  const extractAssetsFromPages = async () => {
    setExtractingAssets(true);
    setExtractionProgress({ total: 0, processed: 0, saved: 0, errors: 0 });
    setExtractedAssets([]);
    
    try {
      // Get token for API calls
      const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
      const stored = localStorage.getItem(storageKey);
      const token = stored ? JSON.parse(stored)?.access_token : null;
      
      if (!token) {
        toast.error('Nejste přihlášeni');
        return;
      }

      // 1. Fetch all pages from kv_store
      console.log('[AssetExtraction] Fetching all pages...');
      const pagesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!pagesResponse.ok) {
        throw new Error(`Failed to fetch pages: ${pagesResponse.status}`);
      }
      
      const { pages } = await pagesResponse.json();
      console.log(`[AssetExtraction] Found ${pages?.length || 0} pages`);
      
      if (!pages || pages.length === 0) {
        toast.info('Nebyly nalezeny žádné migrované stránky');
        return;
      }

      // 2. Extract assets from sectionImages
      const allAssets: ExtractedAssetData[] = [];
      
      for (const page of pages) {
        setExtractionProgress(prev => ({
          ...prev!,
          total: pages.length,
          processed: (prev?.processed || 0) + 1,
          currentPage: page.title || page.slug
        }));
        
        if (!page.sectionImages || page.sectionImages.length === 0) {
          continue;
        }
        
        // Determine category from page data
        const category = page.category || page.legacyIds?.subjectName?.toLowerCase() || 'obecne';
        
        for (const sectionImage of page.sectionImages) {
          if (sectionImage.type === 'lottie' && sectionImage.lottieConfig) {
            const config = sectionImage.lottieConfig;
            
            // Intro animation
            if (config.introUrl) {
              allAssets.push({
                name: `${page.title || page.slug} - Intro`,
                url: config.introUrl,
                category,
                type: 'animation',
                pageSlug: page.slug,
                pageTitle: page.title || page.slug,
                isIntro: true,
                thumbnailUrl: config.backgroundImage
              });
            }
            
            // Step animations
            if (config.steps && config.steps.length > 0) {
              for (let i = 0; i < config.steps.length; i++) {
                const step = config.steps[i];
                if (step.url) {
                  allAssets.push({
                    name: step.title || `${page.title || page.slug} - Krok ${i + 1}`,
                    url: step.url,
                    category,
                    type: 'animation',
                    pageSlug: page.slug,
                    pageTitle: page.title || page.slug,
                    stepIndex: i,
                    thumbnailUrl: config.backgroundImage
                  });
                }
              }
            }
          } else if (sectionImage.type === 'image' && sectionImage.imageUrl) {
            allAssets.push({
              name: `${page.title || page.slug} - Obrázek`,
              url: sectionImage.imageUrl,
              category,
              type: 'image',
              pageSlug: page.slug,
              pageTitle: page.title || page.slug
            });
          }
        }
      }
      
      console.log(`[AssetExtraction] Extracted ${allAssets.length} assets`);
      
      if (allAssets.length === 0) {
        toast.info('Nebyly nalezeny žádné animace nebo obrázky');
        return;
      }
      
      // Update state for UI preview
      setExtractedAssets(allAssets.map(a => ({
        name: a.name,
        url: a.url,
        category: a.category,
        type: a.type,
        pageSlug: a.pageSlug,
        stepIndex: a.stepIndex
      })));
      
      // 3. Save assets to vividbooks_assets table
      console.log('[AssetExtraction] Saving assets to database...');
      let savedCount = 0;
      let errorCount = 0;
      let tableExists = true;
      
      for (const asset of allAssets) {
        // If table doesn't exist, skip the rest
        if (!tableExists) break;
        
        try {
          // Check if asset already exists (by URL)
          const { data: existing, error: checkError } = await supabase
            .from('vividbooks_assets')
            .select('id')
            .eq('file_url', asset.url)
            .maybeSingle();
          
          // Check if table exists
          if (checkError?.code === 'PGRST205') {
            console.warn('[AssetExtraction] Tabulka vividbooks_assets neexistuje. Spusťte SQL migraci v Supabase.');
            tableExists = false;
            toast.error('Tabulka vividbooks_assets neexistuje', {
              description: 'Spusťte SQL migraci v Supabase Dashboard a počkejte 1-2 minuty na obnovení cache.'
            });
            break;
          }
          
          if (checkError) {
            console.error('[AssetExtraction] Error checking existing:', checkError.message);
          }
          
          if (existing) {
            savedCount++; // Count as success since it exists
            continue;
          }
          
          // Build tags from page info
          const tags = [
            asset.pageTitle,
            asset.category,
            asset.type === 'animation' ? 'lottie' : 'image',
            asset.isIntro ? 'intro' : null,
            asset.stepIndex !== undefined ? `krok-${asset.stepIndex + 1}` : null
          ].filter(Boolean);
          
          // Insert new asset
          const { error: insertError } = await supabase
            .from('vividbooks_assets')
            .insert({
              name: asset.name,
              description: `Animace z lekce "${asset.pageTitle}"`,
              asset_type: asset.type,
              file_url: asset.url,
              thumbnail_url: asset.thumbnailUrl,
              category: asset.category,
              tags: tags,
              license_required: true,
              license_tier: 'basic',
              is_active: true
            });
          
          // Check if table exists
          if (insertError?.code === 'PGRST205') {
            tableExists = false;
            toast.error('Tabulka vividbooks_assets neexistuje', {
              description: 'Spusťte SQL migraci v Supabase Dashboard a počkejte 1-2 minuty na obnovení cache.'
            });
            break;
          }
          
          if (insertError) {
            console.error('[AssetExtraction] Insert error:', insertError.message);
            errorCount++;
          } else {
            savedCount++;
          }
          
          setExtractionProgress(prev => ({
            ...prev!,
            saved: savedCount,
            errors: errorCount
          }));
        } catch (err) {
          console.error('[AssetExtraction] Error saving asset:', err);
          errorCount++;
        }
      }
      
      if (tableExists) {
        toast.success(`Uloženo ${savedCount} assetů, ${errorCount} chyb`);
      }
      
    } catch (err) {
      console.error('[AssetExtraction] Error:', err);
      toast.error(`Chyba při extrakci: ${err instanceof Error ? err.message : 'Neznámá chyba'}`);
    } finally {
      setExtractingAssets(false);
    }
  };

  // =============================================
  // API FETCHING
  // =============================================

  const fetchBook = async (bookId: number): Promise<LegacyBook | null> => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/books/${bookId}?user-code=${userCode}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`Error fetching book ${bookId}:`, err);
      return null;
    }
  };

  const fetchAllBooks = async () => {
    setLoading(true);
    setError(null);
    setBooks([]);
    
    try {
      const ids = bookIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      
      if (ids.length === 0) {
        setError('Zadejte alespoň jedno ID knihy');
        setLoading(false);
        return;
      }
      
      const fetchedBooks: LegacyBook[] = [];
      
      for (const id of ids) {
        const book = await fetchBook(id);
        if (book) {
          fetchedBooks.push(book);
        }
      }
      
      if (fetchedBooks.length === 0) {
        setError('Nepodařilo se načíst žádnou knihu');
      } else {
        setBooks(fetchedBooks);
        toast.success(`Načteno ${fetchedBooks.length} knih`);
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při načítání');
    } finally {
      setLoading(false);
    }
  };

  // Fetch menu structure for category
  const fetchMenuStructure = async (category: string) => {
    setLoadingMenu(true);
    console.log(`[Migration] Fetching menu for category: ${category}`);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      console.log(`[Migration] Menu fetch response for ${category}: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[Migration] Menu loaded for ${category}:`, data.menu?.length || 0, 'items');
        setMenuStructure(data.menu || []);
      } else {
        console.error(`[Migration] Failed to load menu for ${category}: ${response.status}`);
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  // Fetch menu when category changes
  useEffect(() => {
    fetchMenuStructure(targetCategory);
    setSelectedDestination(null);
  }, [targetCategory]);

  // Toggle menu item expansion
  const toggleMenuExpand = (itemId: string) => {
    setExpandedMenuItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Get all groups/folders from menu (recursive)
  const getGroupsFromMenu = (items: MenuItem[], parentPath: string = ''): Array<{ id: string; label: string; path: string; depth: number }> => {
    const groups: Array<{ id: string; label: string; path: string; depth: number }> = [];
    
    items.forEach(item => {
      const isGroup = !item.slug || item.type === 'group' || item.type === 'folder' || (item.children && item.children.length > 0);
      if (isGroup) {
        const path = parentPath ? `${parentPath} / ${item.label}` : item.label;
        const depth = parentPath ? parentPath.split(' / ').length : 0;
        groups.push({ id: item.id, label: item.label, path, depth });
        
        if (item.children) {
          groups.push(...getGroupsFromMenu(item.children, path));
        }
      }
    });
    
    return groups;
  };

  // =============================================
  // SELECTION HANDLERS
  // =============================================

  const toggleBook = (bookId: number) => {
    setExpandedBooks(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const selectAllKnowledge = (book: LegacyBook) => {
    const allIds: string[] = [];
    book.chapters.forEach(chapter => {
      chapter.knowledge.forEach(k => {
        allIds.push(`k-${k.id}`);
      });
    });
    
    setSelectedItems(prev => {
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      return next;
    });
  };

  // Helper to get all selectable item IDs from a chapter (knowledge + contentBlock documents)
  const getChapterItemIds = (chapter: LegacyChapter): string[] => {
    const ids: string[] = [];
    // Knowledge items
    chapter.knowledge?.forEach(k => {
      ids.push(`k-${k.id}`);
    });
    // ContentBlock documents (worksheets)
    chapter.contentBlocks?.forEach(block => {
      block.documents?.forEach(doc => {
        ids.push(`cb-${block.id}-doc-${doc.id}`);
      });
    });
    return ids;
  };

  // Helper to get all selectable item IDs from a book
  const getBookItemIds = (book: LegacyBook): string[] => {
    const ids: string[] = [];
    book.chapters.forEach(chapter => {
      ids.push(...getChapterItemIds(chapter));
    });
    return ids;
  };

  const deselectAllKnowledge = (book: LegacyBook) => {
    const allIds = getBookItemIds(book);
    
    setSelectedItems(prev => {
      const next = new Set(prev);
      allIds.forEach(id => next.delete(id));
      return next;
    });
  };

  // Toggle all items in a chapter (knowledge + contentBlock documents)
  const toggleChapterSelection = (chapter: LegacyChapter) => {
    const chapterIds = getChapterItemIds(chapter);
    const allSelected = chapterIds.length > 0 && chapterIds.every(id => selectedItems.has(id));
    
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all
        chapterIds.forEach(id => next.delete(id));
      } else {
        // Select all
        chapterIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Toggle all items in a book
  const toggleBookSelection = (book: LegacyBook) => {
    const bookIds = getBookItemIds(book);
    const allSelected = bookIds.length > 0 && bookIds.every(id => selectedItems.has(id));
    
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allSelected) {
        bookIds.forEach(id => next.delete(id));
      } else {
        bookIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Check selection state for a chapter
  const getChapterSelectionState = (chapter: LegacyChapter): 'none' | 'partial' | 'all' => {
    const chapterIds = getChapterItemIds(chapter);
    if (chapterIds.length === 0) return 'none';
    const selectedCount = chapterIds.filter(id => selectedItems.has(id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === chapterIds.length) return 'all';
    return 'partial';
  };

  // Check selection state for a book
  const getBookSelectionState = (book: LegacyBook): 'none' | 'partial' | 'all' => {
    const bookIds = getBookItemIds(book);
    if (bookIds.length === 0) return 'none';
    const selectedCount = bookIds.filter(id => selectedItems.has(id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === bookIds.length) return 'all';
    return 'partial';
  };

  // =============================================
  // IMPORT LOGIC
  // =============================================

  /**
   * Check if a book is a "workbook-only" book (has only contentBlocks, no knowledge items)
   * These should be imported as a workbook with children worksheets
   */
  const isWorkbookOnlyBook = (book: LegacyBook): boolean => {
    let hasKnowledge = false;
    let hasContentBlocks = false;
    
    book.chapters.forEach(chapter => {
      if (chapter.knowledge && chapter.knowledge.length > 0) {
        hasKnowledge = true;
      }
      if (chapter.contentBlocks && chapter.contentBlocks.length > 0) {
        chapter.contentBlocks.forEach(block => {
          if (block.documents && block.documents.length > 0) {
            hasContentBlocks = true;
          }
        });
      }
    });
    
    // Workbook-only if has contentBlocks but no knowledge
    return hasContentBlocks && !hasKnowledge;
  };

  /**
   * Check if all selected items from a book are contentBlock documents
   * Used to determine if we should create a workbook container
   */
  const areAllSelectedItemsContentBlockDocs = (book: LegacyBook): boolean => {
    const bookIds = getBookItemIds(book);
    const selectedFromBook = bookIds.filter(id => selectedItems.has(id));
    
    if (selectedFromBook.length === 0) return false;
    
    // Check if all selected IDs are contentBlock doc IDs (format: cb-{blockId}-doc-{docId})
    return selectedFromBook.every(id => id.startsWith('cb-'));
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  const importKnowledge = async (
    knowledge: LegacyKnowledge, 
    chapter: LegacyChapter,
    book: LegacyBook,
    accessToken: string
  ): Promise<{ 
    slug: string; 
    coverImageUrl: string;
    worksheet?: { slug: string; coverImageUrl: string } | null;
  }> => {
    const slug = generateSlug(knowledge.name);
    const folder = `${targetCategory}/${slug}`;
    
    try {
      // Build structured content HTML from the knowledge item
      // Similar structure as the manually created "Hmota" lesson
      let content = '';
      
      // Download featured media (main image) if enabled
      let featuredMediaUrl = knowledge.imageUrl || '';
      if (downloadFiles && knowledge.imageUrl) {
        const fileName = getFileNameFromUrl(knowledge.imageUrl);
        const newUrl = await downloadAndUploadFile(knowledge.imageUrl, fileName, folder, accessToken);
        if (newUrl) {
          featuredMediaUrl = newUrl;
          console.log(`[Migration] Featured image uploaded: ${newUrl}`);
        }
      }
      
      // Build section images array - animations go to right panel
      const sectionImages: Array<{
        id: string;
        heading: string;
        type: 'image' | 'lottie';
        imageUrl?: string;
        lottieConfig?: {
          introUrl?: string;
          steps: Array<{ id: string; url: string; title?: string }>;
          shouldLoop: boolean;
          autoplay: boolean;
        };
      }> = [];
      
      // 1. Úvodní text (description) - images stay inline in HTML, not in right panel
      if (knowledge.description) {
        let descriptionHtml = knowledge.description;
        
        // Download and replace inline images in description HTML
        if (downloadFiles) {
          const descImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
          let descImgMatch;
          let descImgIndex = 0;
          const descImgReplacements: Array<{original: string; newUrl: string}> = [];
          
          // Reset regex
          descImgRegex.lastIndex = 0;
          while ((descImgMatch = descImgRegex.exec(knowledge.description)) !== null) {
            const imgUrl = descImgMatch[1];
            if (imgUrl) {
              const fileName = `uvodni_text_img_${descImgIndex}.${getFileExtension(imgUrl) || 'jpg'}`;
              const newUrl = await downloadAndUploadFile(imgUrl, fileName, `${folder}/images`, accessToken);
              if (newUrl) {
                descImgReplacements.push({ original: imgUrl, newUrl });
              }
              descImgIndex++;
            }
          }
          
          // Replace image URLs in HTML
          for (const replacement of descImgReplacements) {
            descriptionHtml = descriptionHtml.replace(replacement.original, replacement.newUrl);
          }
        }
        
        content += `<h2>Úvodní text</h2>\n`;
        content += descriptionHtml;
        content += '\n\n<br><br><br>\n\n'; // 3 empty lines after Úvodní text
      }
      
      // 2. Animace - add to sectionImages for right panel, mapped to "Úvodní text" heading
      if (knowledge.animation?.items && knowledge.animation.items.length > 0) {
        // Download Lottie animations if enabled
        const lottieSteps: Array<{ id: string; url: string; title?: string }> = [];
        
        for (let index = 0; index < knowledge.animation.items.length; index++) {
          const item = knowledge.animation.items[index];
          let animationUrl = item.animationUrl;
          
          if (downloadFiles && item.animationUrl) {
            const fileName = `animation_step_${index + 1}.json`;
            const newUrl = await downloadAndUploadFile(item.animationUrl, fileName, `${folder}/animations`, accessToken);
            if (newUrl) {
              animationUrl = newUrl;
              console.log(`[Migration] Animation step ${index + 1} uploaded: ${newUrl}`);
            }
          }
          
          lottieSteps.push({
            id: `step-${item.id || index}`,
            url: animationUrl,
            title: `Krok ${index + 1}`,
          });
        }
        
        // Download intro animation if present
        let introUrl = knowledge.animation.introAnimationUrl;
        if (downloadFiles && introUrl) {
          const newIntroUrl = await downloadAndUploadFile(introUrl, 'intro_animation.json', `${folder}/animations`, accessToken);
          if (newIntroUrl) {
            introUrl = newIntroUrl;
          }
        }
        
        // Download target2DImageUrl as background for transparent Lottie
        let backgroundImage: string | undefined = knowledge.target2DImageUrl;
        if (downloadFiles && backgroundImage) {
          const bgFileName = `lottie_background.${getFileExtension(backgroundImage) || 'png'}`;
          const newBgUrl = await downloadAndUploadFile(backgroundImage, bgFileName, `${folder}/animations`, accessToken);
          if (newBgUrl) {
            backgroundImage = newBgUrl;
            console.log(`[Migration] Lottie background uploaded: ${newBgUrl}`);
          }
        }
        
        sectionImages.push({
          id: `animation-${knowledge.id}`,
          heading: 'Úvodní text', // Map to the Úvodní text heading
          type: 'lottie',
          lottieConfig: {
            introUrl,
            steps: lottieSteps,
            shouldLoop: knowledge.animation.items.some(item => item.isLoop),
            autoplay: true,
            backgroundImage,
          },
        });
        
        // =============================================
        // AUTOMATICALLY SAVE ANIMATIONS TO VIVIDBOOKS_ASSETS
        // =============================================
        
        // Save animations to vividbooks_assets (fire-and-forget, don't block migration)
        // This runs in the background and won't block the migration process
        const assetSavePromises: Promise<boolean>[] = [];
        
        if (introUrl) {
          assetSavePromises.push(saveAssetToDatabase({
            name: `${knowledge.name} - Intro`,
            url: introUrl,
            category: targetCategory,
            type: 'animation',
            lessonName: knowledge.name,
            lessonSlug: slug,
            isIntro: true,
            thumbnailUrl: backgroundImage,
            tags: [chapter.name, book.name, book.subject?.name || ''].filter(Boolean)
          }));
        }
        
        for (let stepIdx = 0; stepIdx < lottieSteps.length; stepIdx++) {
          const step = lottieSteps[stepIdx];
          assetSavePromises.push(saveAssetToDatabase({
            name: step.title || `${knowledge.name} - Krok ${stepIdx + 1}`,
            url: step.url,
            category: targetCategory,
            type: 'animation',
            lessonName: knowledge.name,
            lessonSlug: slug,
            stepIndex: stepIdx,
            thumbnailUrl: backgroundImage,
            tags: [chapter.name, book.name, book.subject?.name || ''].filter(Boolean)
          }));
        }
        
        // Run in background - don't await, don't block migration
        Promise.all(assetSavePromises).then(results => {
          const saved = results.filter(r => r).length;
          if (saved > 0) {
            console.log(`[Migration] Saved ${saved}/${results.length} animations to vividbooks_assets`);
          }
        }).catch(() => { /* ignore errors */ });
      }
      
      // 3. Diskuze (questions) - otázky k zamyšlení
      if (knowledge.questions) {
        content += `<h2>Diskuze</h2>\n`;
        content += knowledge.questions;
        content += '\n\n<br><br><br>\n\n'; // 3 empty lines after Diskuze
      }
      
      // 4. Závěr/Shrnutí (conclusion) - use summary callout/infobox, images stay inline
      if (knowledge.conclusion) {
        let conclusionHtml = knowledge.conclusion;
        
        // Download and replace inline images in conclusion HTML
        if (downloadFiles) {
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
          let imgMatch;
          let imgIndex = 0;
          const imgReplacements: Array<{original: string; newUrl: string}> = [];
          
          imgRegex.lastIndex = 0;
          while ((imgMatch = imgRegex.exec(knowledge.conclusion)) !== null) {
            const imgUrl = imgMatch[1];
            if (imgUrl) {
              const fileName = `shrnuti_img_${imgIndex}.${getFileExtension(imgUrl) || 'jpg'}`;
              const newUrl = await downloadAndUploadFile(imgUrl, fileName, `${folder}/images`, accessToken);
              if (newUrl) {
                imgReplacements.push({ original: imgUrl, newUrl });
              }
              imgIndex++;
            }
          }
          
          // Replace image URLs in HTML
          for (const replacement of imgReplacements) {
            conclusionHtml = conclusionHtml.replace(replacement.original, replacement.newUrl);
          }
        }
        
        content += `<div class="callout callout-summary" data-type="callout" data-callout-type="summary" data-callout-title="Shrnutí" style="background-color: #eef2ff; border-radius: 12px; padding: 24px; margin: 24px 0;">\n`;
        content += conclusionHtml;
        content += `\n</div>\n\n`;
      }
      
      // 5. Odpovědi (answers)
      if (knowledge.answers) {
        content += `<h2>Odpovědi</h2>\n`;
        content += knowledge.answers;
        content += '\n\n';
      }
      
      // 6. Metodická inspirace (methodicalInspiration) - use methodology callout/infobox (hidden for students)
      if (knowledge.methodicalInspiration) {
        console.log(`[Migration] Methodology content length: ${knowledge.methodicalInspiration.length} chars`);
        
        // Convert H1, H2 to H3 inside methodology content
        let methodologyHtml = knowledge.methodicalInspiration
          .replace(/<h1([^>]*)>/gi, '<h3$1>')
          .replace(/<\/h1>/gi, '</h3>')
          .replace(/<h2([^>]*)>/gi, '<h3$1>')
          .replace(/<\/h2>/gi, '</h3>');
        
        console.log(`[Migration] Methodology HTML length after conversion: ${methodologyHtml.length} chars`);
        
        // Note: No H2 inside - the callout title "Metodická inspirace" is set via data-callout-title
        content += `<div class="callout callout-methodology" data-type="callout" data-callout-type="methodology" data-callout-title="Metodická inspirace" style="background-color: #faf5ff; border-radius: 12px; padding: 24px; margin: 24px 0;">\n`;
        content += methodologyHtml;
        content += `\n</div>\n\n`;
        
        console.log(`[Migration] Total content length after methodology: ${content.length} chars`);
      }
      
      // 7. Související dokumenty - SKIPPED (only PDFs are included)
      
      // 8. PDF odkazy (pouze pracovní list a metodika, bez rozšířeného)
      if (knowledge.pdfUrl || knowledge.methodicalInspirationPdfUrl) {
        content += `<h2>Stáhnout materiály</h2>\n`;
        content += `<ul>\n`;
        
        // Download PDFs if enabled
        let pdfUrl = knowledge.pdfUrl;
        let methodicalPdfUrl = knowledge.methodicalInspirationPdfUrl;
        
        if (downloadFiles) {
          if (pdfUrl) {
            const newUrl = await downloadAndUploadFile(pdfUrl, 'pracovni_list.pdf', `${folder}/pdfs`, accessToken);
            if (newUrl) pdfUrl = newUrl;
          }
          if (methodicalPdfUrl) {
            const newUrl = await downloadAndUploadFile(methodicalPdfUrl, 'metodicka_inspirace.pdf', `${folder}/pdfs`, accessToken);
            if (newUrl) methodicalPdfUrl = newUrl;
          }
        }
        
        if (pdfUrl) {
          content += `<li><a href="${pdfUrl}" target="_blank">📥 Pracovní list (PDF)</a></li>\n`;
        }
        if (methodicalPdfUrl) {
          content += `<li><a href="${methodicalPdfUrl}" target="_blank">📥 Metodická inspirace (PDF)</a></li>\n`;
        }
        content += `</ul>\n`;
      }
      
      console.log(`[Migration] Final content length: ${content.length} chars`);
      console.log(`[Migration] Content has methodology callout: ${content.includes('callout-methodology')}`);
      
      // For matematika, don't include sectionImages (no side panel images)
      const includeSectionImages = targetCategory !== 'matematika';
      
      const pageData = {
        slug,
        title: knowledge.name,
        content,
        description: '', // Description is already in content as "Úvodní text"
        category: targetCategory,
        documentType: 'lesson',
        featuredMedia: '', // Don't show in right panel, only use as coverImage in menu
        sectionImages: includeSectionImages ? sectionImages : [],
        // Legacy IDs for tracking origin
        legacyIds: {
          knowledgeId: knowledge.id,
          chapterId: chapter.id,
          chapterName: chapter.name,
          bookId: book.id,
          bookName: book.name,
          subjectId: book.subject?.id,
          subjectName: book.subject?.name,
        },
        // Additional legacy metadata
        legacyMetadata: {
          isDemo: knowledge.isDemo,
          isRvp: knowledge.isRvp,
          methodicsOnly: knowledge.methodicsOnly,
          languageCode: knowledge.languageCode,
          textbookId: knowledge.textbookId,
          createdByTeacher: knowledge.createdByTeacher,
          disabled: knowledge.disabled,
          relatedKnowledgeIds: knowledge.relatedKnowledgeIds,
        },
      };

      let response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(pageData)
        }
      );

      // If page exists and overwrite is enabled, try PUT to update
      if (response.status === 409 && overwriteExisting) {
        console.log(`[Migration] Page ${slug} already exists, updating...`);
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${slug}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(pageData)
          }
        );
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Create worksheet document if pdfUrl exists
      let worksheetResult: { slug: string; coverImageUrl: string } | null = null;
      
      if (knowledge.pdfUrl) {
        try {
          const worksheetSlug = `${slug}-pracovni-list`;
          const worksheetFolder = `${targetCategory}/${worksheetSlug}`;
          
          console.log(`[Migration] Creating worksheet for: ${knowledge.name}`);
          
          // Download PDF and get URL
          let pdfStorageUrl = knowledge.pdfUrl;
          if (downloadFiles) {
            const downloadedUrl = await downloadAndUploadFile(
              knowledge.pdfUrl, 
              'pracovni_list.pdf', 
              worksheetFolder, 
              accessToken
            );
            if (downloadedUrl) {
              pdfStorageUrl = downloadedUrl;
            }
          }
          
          // Generate PDF preview thumbnail
          let worksheetCoverUrl = '';
          try {
            const previewUrl = await generatePdfPreview(
              pdfStorageUrl, 
              worksheetFolder, 
              accessToken
            );
            if (previewUrl) {
              worksheetCoverUrl = previewUrl;
              console.log(`[Migration] Worksheet preview generated: ${previewUrl}`);
            }
          } catch (previewErr) {
            console.warn(`[Migration] Could not generate PDF preview:`, previewErr);
          }
          
          // Download solution PDF if it exists
          let solutionStorageUrl = knowledge.solutionUrl || '';
          if (downloadFiles && knowledge.solutionUrl) {
            const downloadedSolutionUrl = await downloadAndUploadFile(
              knowledge.solutionUrl, 
              'reseni.pdf', 
              worksheetFolder, 
              accessToken
            );
            if (downloadedSolutionUrl) {
              solutionStorageUrl = downloadedSolutionUrl;
              console.log(`[Migration] Solution PDF uploaded: ${downloadedSolutionUrl}`);
            }
          }
          
          // Create worksheet page content
          let worksheetContent = `
<h2>Pracovní list</h2>
<p>Pracovní list k lekci <strong>${knowledge.name}</strong>.</p>
<p style="display: flex; gap: 12px; flex-wrap: wrap;">
  <a href="${pdfStorageUrl}" target="_blank" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">📥 Stáhnout pracovní list (PDF)</a>`;
          
          // Add solution button if solution exists
          if (solutionStorageUrl) {
            worksheetContent += `
  <a href="${solutionStorageUrl}" target="_blank" class="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">✅ Řešení (PDF)</a>`;
          }
          
          worksheetContent += `
</p>

<iframe src="${pdfStorageUrl}" style="width: 100%; height: 800px; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 16px;" allowfullscreen></iframe>
`;
          
          const worksheetData = {
            slug: worksheetSlug,
            title: `${knowledge.name} - Pracovní list`,
            content: worksheetContent,
            description: `Pracovní list k lekci ${knowledge.name}`,
            category: targetCategory,
            documentType: 'worksheet',
            featuredMedia: worksheetCoverUrl,
            // Legacy IDs for tracking origin
            legacyIds: {
              knowledgeId: knowledge.id,
              chapterId: chapter.id,
              bookId: book.id,
              type: 'worksheet',
            },
          };
          
          let worksheetResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify(worksheetData)
            }
          );
          
          // If worksheet exists and overwrite is enabled, try PUT to update
          if (worksheetResponse.status === 409 && overwriteExisting) {
            console.log(`[Migration] Worksheet ${worksheetSlug} already exists, updating...`);
            worksheetResponse = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${worksheetSlug}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(worksheetData)
              }
            );
          }
          
          if (worksheetResponse.ok) {
            worksheetResult = {
              slug: worksheetSlug,
              coverImageUrl: worksheetCoverUrl,
            };
            console.log(`[Migration] Worksheet created: ${worksheetSlug}`);
          } else {
            console.warn(`[Migration] Failed to create worksheet: ${worksheetResponse.status}`);
          }
        } catch (worksheetErr) {
          console.error(`[Migration] Error creating worksheet:`, worksheetErr);
          // Don't throw - worksheet creation is optional
        }
      }

      return { slug, coverImageUrl: featuredMediaUrl, worksheet: worksheetResult };
    } catch (err: any) {
      console.error(`Error importing knowledge ${knowledge.id}:`, err);
      throw err;
    }
  };

  /**
   * Import a contentBlock document (worksheet from worksheet-only books)
   * These are pure PDF worksheets without lesson content
   */
  const importContentBlockDocument = async (
    doc: LegacyContentBlockDocument,
    block: LegacyContentBlock,
    chapter: LegacyChapter,
    book: LegacyBook,
    accessToken: string,
    ucebniTextSlug?: string // Slug of the učební text document for this block
  ): Promise<{ slug: string; coverImageUrl: string; extendedWorksheet: any }> => {
    const slug = generateSlug(doc.name);
    const storageFolder = `migrations/${targetCategory}/${slug}`;
    
    console.log(`[Migration] Importing contentBlock document: ${doc.name} -> ${slug}`);

    try {
      // Download and upload the main PDF
      let pdfStorageUrl = doc.documentUrl;
      if (doc.documentUrl) {
        const downloaded = await downloadAndUploadFile(
          doc.documentUrl,
          `${slug}-worksheet.pdf`,
          storageFolder,
          accessToken
        );
        if (downloaded) pdfStorageUrl = downloaded;
      }

      // Download and upload preview image (for cover)
      let previewStorageUrl = doc.previewUrl || '';
      if (doc.previewUrl) {
        const downloaded = await downloadAndUploadFile(
          doc.previewUrl,
          `${slug}-preview.jpg`,
          storageFolder,
          accessToken
        );
        if (downloaded) previewStorageUrl = downloaded;
      }

      // Download and upload solution PDF if exists
      let solutionStorageUrl = '';
      if (doc.solutionUrl) {
        const downloaded = await downloadAndUploadFile(
          doc.solutionUrl,
          `${slug}-solution.pdf`,
          storageFolder,
          accessToken
        );
        if (downloaded) solutionStorageUrl = downloaded;
      }

      // Build content HTML for the worksheet document
      let content = `<h1>${doc.name}</h1>\n\n`;
      
      // Add block's learning content if available
      if (block.content && block.content.length > 100) {
        content += `<h2>Učební text</h2>\n${block.content}\n\n`;
      }

      // Add PDF download section
      content += `<h2>Pracovní list</h2>\n`;
      content += `<p><a href="${pdfStorageUrl}" target="_blank" download class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">📄 Stáhnout pracovní list (PDF)</a></p>\n`;
      
      // Embed PDF viewer
      content += `<div style="margin-top: 16px;"><iframe src="${pdfStorageUrl}" width="100%" height="600px" style="border: 1px solid #e2e8f0; border-radius: 8px;"></iframe></div>\n\n`;

      // Add solution if exists
      if (solutionStorageUrl) {
        content += `<h2>Řešení</h2>\n`;
        content += `<p><a href="${solutionStorageUrl}" target="_blank" download class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">✅ Stáhnout řešení (PDF)</a></p>\n\n`;
      }

      // Add interactive worksheets if any
      if (doc.interactiveWorksheets && doc.interactiveWorksheets.length > 0) {
        content += `<h2>Interaktivní verze</h2>\n<ul>\n`;
        doc.interactiveWorksheets.forEach(iw => {
          const link = iw.url || iw.playableLink; // Prioritize url (board ID)
          content += `<li><a href="${link}" target="_blank">${iw.name}</a></li>\n`;
        });
        content += `</ul>\n\n`;
      }

      // Add practices if any
      if (doc.practices && doc.practices.length > 0) {
        content += `<h2>Procvičování</h2>\n<ul>\n`;
        doc.practices.forEach(p => {
          const link = p.url || p.playableLink; // Prioritize url (board ID)
          content += `<li><a href="${link}" target="_blank">${p.name}</a> (úroveň ${p.level || 1})</li>\n`;
        });
        content += `</ul>\n\n`;
      }

      // Get methodology PDF from block if available
      let methodologyStorageUrl = '';
      const methodologyDocs = block.methodicalInspirationsPdf || [];
      if (methodologyDocs.length > 0 && methodologyDocs[0].documentUrl) {
        // Try to download, or use original URL
        const downloaded = await downloadAndUploadFile(
          methodologyDocs[0].documentUrl,
          `${slug}-methodology.pdf`,
          storageFolder,
          accessToken
        );
        methodologyStorageUrl = downloaded || methodologyDocs[0].documentUrl;
      }

      // Get textbook PDF if available
      let textbookStorageUrl = '';
      if (block.textbookPdfUrl) {
        const downloaded = await downloadAndUploadFile(
          block.textbookPdfUrl,
          `${slug}-textbook.pdf`,
          storageFolder,
          accessToken
        );
        textbookStorageUrl = downloaded || block.textbookPdfUrl;
      }

      // Build worksheetData for WorksheetView component
      const worksheetData = {
        previewImageUrl: previewStorageUrl || doc.previewUrl,
        pdfUrl: pdfStorageUrl || doc.documentUrl,
        solutionPdfUrl: solutionStorageUrl || doc.solutionUrl || undefined,
        // Link to učební text document if available, otherwise fallback to PDF
        textbookUrl: ucebniTextSlug 
          ? `/docs/${targetCategory}/${ucebniTextSlug}` 
          : (textbookStorageUrl || block.textbookPdfUrl || undefined),
        methodologyUrl: methodologyStorageUrl || undefined,
        // Map exercises (practices)
        exercises: (doc.practices || []).map((p: any, idx: number) => ({
          id: `ex-${doc.id}-${idx}`,
          label: p.name || `Procvičování ${idx + 1}`,
          url: p.url || p.playableLink || '', // Prioritize url (board ID) over playableLink
          level: p.level || 1,
        })),
        // Map minigames
        minigames: (doc.minigames || []).map((m: any, idx: number) => ({
          id: `mg-${doc.id}-${idx}`,
          label: m.name || `Minihra ${idx + 1}`,
          url: m.url || m.playableLink || '', // Prioritize url (board ID) over playableLink
          type: 'interactive' as const,
        })),
        // Map tests
        tests: (doc.tests || []).map((t: any, idx: number) => ({
          id: `test-${doc.id}-${idx}`,
          label: t.name || `Test ${idx + 1}`,
          url: t.url || t.playableLink || t.documentUrl || '', // Prioritize url (board ID) over playableLink
          type: (t.documentUrl ? 'pdf' : 'link') as 'pdf' | 'link',
        })),
        // Map abcdTests as exams (písemky)
        exams: (doc.abcdTests || []).map((e: any, idx: number) => ({
          id: `exam-${doc.id}-${idx}`,
          label: e.name || `Písemka ${idx + 1}`,
          url: e.url || e.playableLink || e.documentUrl || '', // Prioritize url (board ID) over playableLink
          type: (e.documentUrl ? 'pdf' : 'link') as 'pdf' | 'link',
        })),
        // Map bonusSheets + bonuses as bonuses
        bonuses: [
          ...(doc.bonusSheets || []).map((b: any, idx: number) => ({
            id: `bonus-sheet-${doc.id}-${idx}`,
            label: b.name || `Bonus ${idx + 1}`,
            url: b.documentUrl || b.url || '',
            type: 'pdf' as const,
          })),
          ...(doc.bonuses || []).map((b: any, idx: number) => ({
            id: `bonus-${doc.id}-${idx}`,
            label: b.name || `Příloha ${idx + 1}`,
            url: b.url || b.playableLink || '', // Prioritize url (board ID) over playableLink
            type: 'link' as const,
          })),
        ],
        // Map interactive worksheets (VividBoard)
        interactiveWorksheets: (doc.interactiveWorksheets || []).map((iw: any, idx: number) => ({
          id: `iw-${doc.id}-${idx}`,
          label: iw.name || `Interaktivní verze ${idx + 1}`,
          url: iw.url || iw.playableLink || '', // Prioritize url (board ID) over playableLink
          type: 'interactive' as const,
        })),
        // Map interactive solutions
        interactiveSolutions: (doc.interactiveSolutions || []).map((is: any, idx: number) => ({
          id: `is-${doc.id}-${idx}`,
          label: is.name || `Interaktivní řešení ${idx + 1}`,
          url: is.url || is.playableLink || '', // Prioritize url (board ID) over playableLink
          type: 'interactive' as const,
        })),
      };

      // Prepare page data
      const pageData = {
        category: targetCategory,
        slug: slug,
        title: doc.name,
        description: `Pracovní list: ${doc.name}`,
        content: content,
        documentType: 'worksheet',
        featuredMedia: previewStorageUrl || doc.previewUrl,
        sectionImages: [],
        worksheetData: worksheetData, // Add worksheet data for WorksheetView
        legacyIds: {
          documentId: doc.id,
          blockId: block.id,
          chapterId: chapter.id,
          bookId: book.id,
          subjectId: book.subject?.id,
          textbookId: doc.textbookId,
        },
        legacyMetadata: {
          type: doc.type,
          containsCorrectAnswers: doc.containsCorrectAnswers,
          isRvp: doc.isRvp,
          hasSolution: !!doc.solutionUrl,
          hasTextbook: !!textbookStorageUrl,
          hasMethodology: !!methodologyStorageUrl,
          languageCode: doc.languageCode || 'cs',
          bookName: book.name,
          chapterName: chapter.name,
          blockName: block.name,
        },
      };

      // Create the page
      let response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(pageData)
        }
      );

      // Handle overwrite
      if (response.status === 409 && overwriteExisting) {
        console.log(`[Migration] Page ${slug} already exists, updating...`);
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${slug}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(pageData)
          }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Migration] Failed to create page: ${response.status} - ${errorText}`);
        throw new Error(`Failed to create page: ${response.status}`);
      }

      // Build extendedWorksheet data for the menu item
      const extendedWorksheet = {
        isExtended: true,
        // Řešení PDF
        solutionPdf: solutionStorageUrl ? { label: 'Řešení', url: solutionStorageUrl } : undefined,
        // Interaktivní pracovní listy
        interactive: (doc.interactiveWorksheets || []).map((iw: any) => ({
          label: iw.name || 'Interaktivní verze',
          url: iw.url || iw.playableLink || '', // Prioritize url (board ID)
        })),
        // Učební text
        textbook: ucebniTextSlug 
          ? { label: 'Učební text', url: `/docs/${targetCategory}/${ucebniTextSlug}` }
          : (textbookStorageUrl ? { label: 'Učební text', url: textbookStorageUrl } : undefined),
        // Metodika
        methodology: methodologyStorageUrl 
          ? { label: 'Metodika', url: methodologyStorageUrl } 
          : undefined,
        // Procvičování
        practice: (doc.practices || []).map((p: any) => ({
          label: p.name || 'Procvičování',
          url: p.url || p.playableLink || '', // Prioritize url (board ID)
          level: p.level || 1,
        })),
        // Procvičovací minihry
        minigames: (doc.minigames || []).map((m: any) => ({
          label: m.name || 'Minihra',
          url: m.url || m.playableLink || '', // Prioritize url (board ID)
        })),
        // Testy
        tests: (doc.tests || []).map((t: any) => ({
          label: t.name || 'Test',
          url: t.url || t.playableLink || t.documentUrl || '', // Prioritize url (board ID)
        })),
        // Písemky (abcdTests)
        exams: (doc.abcdTests || []).map((e: any) => ({
          label: e.name || 'Písemka',
          url: e.url || e.playableLink || e.documentUrl || '', // Prioritize url (board ID)
        })),
        // Bonusy
        bonuses: [
          ...(doc.bonusSheets || []).map((b: any) => ({
            label: b.name || 'Bonus',
            url: b.documentUrl || b.url || '',
          })),
          ...(doc.bonuses || []).map((b: any) => ({
            label: b.name || 'Příloha',
            url: b.url || b.playableLink || '', // Prioritize url (board ID)
          })),
        ],
      };

      console.log(`[Migration] ContentBlock doc imported successfully: ${slug}`);
      return { slug, coverImageUrl: previewStorageUrl, extendedWorksheet };
    } catch (err: any) {
      console.error(`Error importing contentBlock doc ${doc.id}:`, err);
      throw err;
    }
  };

  /**
   * Import učební text (educational content) from a ContentBlock
   * This creates a separate "lesson" document with the block's content
   */
  const importContentBlockText = async (
    block: LegacyContentBlock,
    chapter: LegacyChapter,
    book: LegacyBook,
    accessToken: string
  ): Promise<{ slug: string; coverImageUrl: string }> => {
    const slug = generateSlug(`ucebni-text-${block.name}`);
    const storageFolder = `migrations/${targetCategory}/${slug}`;
    
    console.log(`[Migration] Importing učební text: ${block.name} -> ${slug}`);

    try {
      // Download and upload cover image if available
      let coverImageUrl = block.imageUrl || '';
      if (block.imageUrl && downloadFiles) {
        const downloaded = await downloadAndUploadFile(
          block.imageUrl,
          `${slug}-cover.jpg`,
          storageFolder,
          accessToken
        );
        if (downloaded) coverImageUrl = downloaded;
      }

      // Build content HTML - don't add automatic heading
      let content = block.content || '';
      
      // Remove first heading if it matches the block name
      const blockNameLower = block.name.toLowerCase().trim();
      const h1Match = content.match(/^<h1[^>]*>([^<]*)<\/h1>/i);
      const h2Match = content.match(/^<h2[^>]*>([^<]*)<\/h2>/i);
      
      if (h1Match && h1Match[1].toLowerCase().trim() === blockNameLower) {
        content = content.replace(h1Match[0], '').trim();
      } else if (h2Match && h2Match[1].toLowerCase().trim() === blockNameLower) {
        content = content.replace(h2Match[0], '').trim();
      }

      // If there are related quizzes, add links
      if (block.relatedQuizzes && block.relatedQuizzes.length > 0) {
        content += `\n\n<h2>Související kvízy</h2>\n<ul>\n`;
        block.relatedQuizzes.forEach((q: any) => {
          content += `<li>${q.name || q.title || 'Kvíz'}</li>\n`;
        });
        content += `</ul>\n`;
      }

      // Prepare page data
      const pageData = {
        category: targetCategory,
        slug: slug,
        title: block.name,
        description: '', // No description for učební text
        content: content,
        documentType: 'ucebni-text', // Učební text má vlastní typ
        featuredMedia: '', // No featured media for učební text
        sectionImages: [],
        legacyIds: {
          contentBlockId: block.id,
          chapterId: chapter.id,
          bookId: book.id,
          subjectId: book.subject?.id,
          chapterName: chapter.name,
          bookName: book.name,
          subjectName: book.subject?.name,
        },
        legacyMetadata: {
          isRvp: block.isRvp,
          titles: block.titles,
        }
      };

      // Create the page
      let response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(pageData)
        }
      );

      // Handle overwrite
      if (response.status === 409 && overwriteExisting) {
        console.log(`[Migration] Page ${slug} already exists, updating...`);
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${slug}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(pageData)
          }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Migration] Failed to create učební text: ${response.status} - ${errorText}`);
        throw new Error(`Failed to create page: ${response.status}`);
      }

      console.log(`[Migration] Učební text imported successfully: ${slug}`);
      return { slug, coverImageUrl };
    } catch (err: any) {
      console.error(`Error importing učební text ${block.id}:`, err);
      throw err;
    }
  };

  /**
   * Import a board from legacy URL and return the new board ID
   * If import fails, returns null (fallback to URL link)
   */
  const importLegacyBoard = async (
    url: string,
    title: string,
    accessToken: string
  ): Promise<string | null> => {
    if (!url || !isImportableBoardUrl(url)) {
      return null;
    }
    
    const boardId = extractBoardId(url);
    if (!boardId) {
      console.log(`[Migration] Could not extract board ID from: ${url}`);
      return null;
    }
    
    console.log(`[Migration] Importing board: ${title} (${boardId})`);
    
    try {
      const imported = await importBoardFromLegacy(url, title);
      
      if (!imported || imported.slidesCount === 0) {
        console.warn(`[Migration] Board import returned no slides: ${boardId}`);
        return null;
      }
      
      // Create and save the quiz/board
      const quiz = createEmptyQuiz(imported.id);
      quiz.title = imported.title;
      quiz.slides = imported.slides;
      quiz.createdAt = new Date().toISOString();
      quiz.updatedAt = new Date().toISOString();
      
      // Save to localStorage
      saveQuiz(quiz);
      
      // ALSO save to Supabase pages API (teacher_boards has RLS issues)
      try {
        const boardSlug = `board-${quiz.id}`;
        console.log(`[Migration] Saving board to pages API: ${boardSlug}`);
        
        const pagesResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              slug: boardSlug,
              title: quiz.title,
              category: targetCategory,
              type: 'board',
              worksheetData: quiz
            })
          }
        );
        
        if (pagesResponse.ok) {
          console.log(`[Migration] ✓ Board saved to pages API: ${boardSlug}`);
        } else {
          console.warn(`[Migration] Failed to save board to pages API: ${pagesResponse.status}`);
        }
      } catch (pagesError) {
        console.error(`[Migration] Error saving board to pages API:`, pagesError);
      }
      
      console.log(`[Migration] ✓ Board imported and saved: ${quiz.id} (${quiz.slides.length} slides)`);
      
      return quiz.id;
    } catch (err) {
      console.error(`[Migration] Failed to import board ${boardId}:`, err);
      return null;
    }
  };

  /**
   * Process menu items and import boards where possible
   * Modifies items in place, changing externalUrl to board:// format
   */
  const processMenuItemsForBoards = async (
    items: MenuItem[],
    accessToken: string,
    updateStatus: (message: string) => void
  ): Promise<void> => {
    const boardTypes = ['practice', 'test', 'exam', 'interactive', 'bonus'];
    
    for (const item of items) {
      // Check if this item should have its board imported
      if (boardTypes.includes(item.type || '') && item.externalUrl && isImportableBoardUrl(item.externalUrl)) {
        updateStatus(`Importuji board: ${item.label}`);
        
        const newBoardId = await importLegacyBoard(
          item.externalUrl,
          item.label,
          accessToken
        );
        
        if (newBoardId) {
          // Replace external URL with board:// protocol
          item.externalUrl = `board://${newBoardId}`;
          item.url = `board://${newBoardId}`;
          console.log(`[Migration] Board linked: ${item.label} -> board://${newBoardId}`);
        }
      }
      
      // Recursively process children
      if (item.children && item.children.length > 0) {
        await processMenuItemsForBoards(item.children, accessToken, updateStatus);
      }
    }
  };

  const startImport = async () => {
    console.log('[Migration] startImport called');
    console.log('[Migration] selectedItems:', selectedItems.size);
    console.log('[Migration] importing state:', importing);
    
    // Prevent double-click
    if (importing) {
      console.log('[Migration] Already importing, skipping');
      return;
    }
    
    if (selectedItems.size === 0) {
      toast.error('Vyberte alespoň jednu položku k importu');
      console.log('[Migration] No items selected, aborting');
      return;
    }
    
    // SAFETY CHECK: Confirm target category before import
    const categoryLabel = targetCategory === 'fyzika' ? 'FYZIKA' : 
                         targetCategory === 'matematika' ? 'MATEMATIKA' : 
                         targetCategory.toUpperCase();
    
    const confirmMessage = `⚠️ POZOR: Data budou importována do kategorie:\n\n` +
      `   📁 ${categoryLabel}\n\n` +
      `Počet položek k importu: ${selectedItems.size}\n\n` +
      `Je toto SPRÁVNÁ kategorie?`;
    
    if (!window.confirm(confirmMessage)) {
      console.log('[Migration] User cancelled - wrong category');
      toast.info('Import zrušen - zkontrolujte cílovou kategorii');
      return;
    }
    
    // Set importing flag IMMEDIATELY to prevent race condition
    setImporting(true);

    // Get access token reliably
    console.log('[Migration] Getting access token...');
    
    let accessToken: string | null = null;
    
    try {
      const { data: { session } } = await getSupabaseSession();
      if (session?.access_token) {
        accessToken = session.access_token;
        console.log('[Migration] Access token obtained successfully');
      } else {
        // Try refresh if session is missing but we're supposed to be logged in
        console.log('[Migration] No session, trying refresh...');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Refresh timeout')), 5000)
        );
        const refreshPromise = supabase.auth.refreshSession();
        const refreshResult = await Promise.race([refreshPromise, timeoutPromise]) as any;
        
        if (refreshResult.data?.session?.access_token) {
          accessToken = refreshResult.data.session.access_token;
          console.log('[Migration] Got token from refresh');
        }
      }
    } catch (err) {
      console.error('[Migration] Error getting session:', err);
    }
    
    if (!accessToken) {
      console.error('[Migration] Could not get access token');
      toast.error('Nelze získat přístupový token. Zkuste obnovit stránku (F5) a znovu se přihlásit.');
      setImporting(false);
      return;
    }
    
    console.log('[Migration] Starting import...');
    // setImporting(true) already called at start
    const importedMenuItems: MenuItem[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Collect all items to import (knowledge + contentBlock documents)
    const knowledgeToImport: Array<{ knowledge: LegacyKnowledge; chapter: LegacyChapter; book: LegacyBook }> = [];
    const contentBlockDocsToImport: Array<{ 
      doc: LegacyContentBlockDocument; 
      block: LegacyContentBlock; 
      chapter: LegacyChapter; 
      book: LegacyBook 
    }> = [];
    const initialStatuses: ImportStatus[] = [];
    
    books.forEach(book => {
      book.chapters.forEach(chapter => {
        // Knowledge items (lessons)
        chapter.knowledge?.forEach(knowledge => {
          if (selectedItems.has(`k-${knowledge.id}`)) {
            knowledgeToImport.push({ knowledge, chapter, book });
            initialStatuses.push({
              id: `k-${knowledge.id}`,
              type: 'knowledge',
              name: knowledge.name,
              status: 'pending'
            });
          }
        });
        
        // ContentBlock documents (worksheets)
        chapter.contentBlocks?.forEach(block => {
          block.documents?.forEach(doc => {
            const docId = `cb-${block.id}-doc-${doc.id}`;
            if (selectedItems.has(docId)) {
              contentBlockDocsToImport.push({ doc, block, chapter, book });
              initialStatuses.push({
                id: docId,
                type: 'knowledge', // reuse type for UI
                name: doc.name,
                status: 'pending'
              });
            }
          });
        });
      });
    });

    setImportStatuses(initialStatuses);
    console.log('[Migration] Knowledge items to import:', knowledgeToImport.length);
    console.log('[Migration] ContentBlock docs to import:', contentBlockDocsToImport.length);

    // Group knowledge items by book for organized folder structure
    const knowledgeByBook = new Map<number, typeof knowledgeToImport>();
    knowledgeToImport.forEach(item => {
      const bookId = item.book.id;
      if (!knowledgeByBook.has(bookId)) {
        knowledgeByBook.set(bookId, []);
      }
      knowledgeByBook.get(bookId)!.push(item);
    });

    // Import knowledge items (lessons) organized by book
    for (const [bookId, bookKnowledgeItems] of knowledgeByBook) {
      const book = bookKnowledgeItems[0].book;
      const bookLessons: MenuItem[] = [];
      const bookWorksheets: MenuItem[] = [];
      
      console.log(`[Migration] Processing ${bookKnowledgeItems.length} lessons from book: ${book.name}`);
      
      for (const item of bookKnowledgeItems) {
        console.log('[Migration] Importing knowledge:', item.knowledge.name);
        // Update status to importing
        setImportStatuses(prev => prev.map(s => 
          s.id === `k-${item.knowledge.id}` 
            ? { ...s, status: 'importing' } 
            : s
        ));

        try {
          const result = await importKnowledge(item.knowledge, item.chapter, item.book, accessToken);
          
          // Add lesson to book folder
          bookLessons.push({
            id: `imported-${item.knowledge.id}-${Math.random().toString(36).slice(2, 8)}`,
            label: item.knowledge.name,
            slug: result.slug,
            type: 'lesson',
            coverImage: result.coverImageUrl,
          });
          
          // Add worksheet to book folder if it was created
          if (result.worksheet) {
            bookWorksheets.push({
              id: `imported-${item.knowledge.id}-ws-${Math.random().toString(36).slice(2, 8)}`,
              label: `${item.knowledge.name} - Pracovní list`,
              slug: result.worksheet.slug,
              type: 'worksheet',
              coverImage: result.worksheet.coverImageUrl,
            });
            console.log(`[Migration] Worksheet added: ${result.worksheet.slug}`);
          }
          
          successCount++;
          
          setImportStatuses(prev => prev.map(s => 
            s.id === `k-${item.knowledge.id}` 
              ? { ...s, status: 'success' } 
              : s
          ));
        } catch (err: any) {
          const errorMessage = err.message || 'Neznámá chyba';
          const isAlreadyExists = errorMessage.includes('already exists') || errorMessage.includes('409');
          
          if (isAlreadyExists) {
            const slug = generateSlug(item.knowledge.name);
            bookLessons.push({
              id: `imported-${item.knowledge.id}-${Math.random().toString(36).slice(2, 8)}`,
              label: item.knowledge.name,
              slug: slug,
              type: 'lesson',
              coverImage: item.knowledge.imageUrl || '',
            });
            successCount++;
            
            setImportStatuses(prev => prev.map(s => 
              s.id === `k-${item.knowledge.id}` 
                ? { ...s, status: 'success', error: 'Stránka již existovala' } 
                : s
            ));
          } else {
            errorCount++;
            console.error(`Error importing ${item.knowledge.name}:`, err);
            
            setImportStatuses(prev => prev.map(s => 
              s.id === `k-${item.knowledge.id}` 
                ? { ...s, status: 'error', error: errorMessage } 
                : s
            ));
          }
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Create folder for this book's lessons (if we have multiple items)
      const allBookItems = [...bookLessons, ...bookWorksheets];
      
      if (allBookItems.length > 0) {
        if (allBookItems.length >= 2) {
          // Create a folder containing lessons and worksheets
          const folderSlug = generateSlug(`lekce-${book.name}`);
          const bookFolder: MenuItem = {
            id: `imported-lessons-folder-${bookId}-${Math.random().toString(36).slice(2, 8)}`,
            label: book.name,
            slug: folderSlug,
            type: 'folder',
            icon: 'folder',
            coverImage: book.imageUrl || '',
            children: allBookItems,
          };
          
          console.log(`[Migration] Created lessons folder: ${book.name} with ${allBookItems.length} items`);
          importedMenuItems.push(bookFolder);
        } else {
          // Single item - add directly to menu
          importedMenuItems.push(...allBookItems);
        }
      }
    }

    // Import contentBlock documents (worksheets)
    // ALWAYS group by book/chapter to create workbook containers when there are multiple worksheets
    // This applies to both workbook-only books AND mixed books (lessons + worksheets)
    
    // Group by book first, then by chapter
    const docsByBookAndChapter = new Map<string, typeof contentBlockDocsToImport>();
    contentBlockDocsToImport.forEach(item => {
      // Use book name as the workbook name (or chapter if there are multiple chapters with docs)
      const key = `${item.book.id}`;
      if (!docsByBookAndChapter.has(key)) {
        docsByBookAndChapter.set(key, []);
      }
      docsByBookAndChapter.get(key)!.push(item);
    });

    // Track which content blocks have been processed for učební text (to avoid duplicates)
    const processedContentBlocks = new Set<number>();

    // Process each book's documents
    for (const [bookKey, bookDocs] of docsByBookAndChapter) {
      const book = bookDocs[0].book;
      
      // Always create workbook container when there are multiple worksheets (2+)
      const shouldCreateWorkbook = bookDocs.length >= 2;
      const workbookChildren: MenuItem[] = [];
      const folderChildren: MenuItem[] = []; // Separate children for folder (includes učební texty)
      
      // Map to store worksheets by docId for reliable lookup when building folder structure
      const worksheetsByDocId = new Map<number, MenuItem>();
      
      console.log(`[Migration] Processing ${bookDocs.length} worksheet(s) from book: ${book.name}, createWorkbook: ${shouldCreateWorkbook}, targetCategory: ${targetCategory}`);
      
      // Map to store učební text slugs by blockId for later use in worksheets
      const ucebniTextSlugs = new Map<number, string>();
      
      // First, import učební texty (educational texts) for each unique ContentBlock
      for (const item of bookDocs) {
        const blockId = item.block.id;
        
        // Skip if already processed
        if (processedContentBlocks.has(blockId)) continue;
        // Skip only if completely empty (allow short content)
        if (!item.block.content || item.block.content.trim().length === 0) continue;
        
        processedContentBlocks.add(blockId);
        
        console.log(`[Migration] Importing učební text for block: ${item.block.name}`);
        
        try {
          const result = await importContentBlockText(item.block, item.chapter, item.book, accessToken);
          
          // Store the slug for later use in worksheetData.textbookUrl
          ucebniTextSlugs.set(blockId, result.slug);
          
          // Create učební text menu item - add to folder only
          const textMenuItem: MenuItem = {
            id: `imported-text-${blockId}-${Math.random().toString(36).slice(2, 8)}`,
            label: item.block.name,
            slug: result.slug,
            type: 'ucebni-text',
            icon: 'book-open',
            coverImage: result.coverImageUrl,
          };
          
          // Add to folder children (učební texty go into folder, not workbook)
          folderChildren.push(textMenuItem);
          
          console.log(`[Migration] Učební text imported: ${item.block.name}`);
        } catch (err) {
          console.warn(`[Migration] Failed to import učební text for ${item.block.name}:`, err);
          // Don't count as error - učební text is optional
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      for (const item of bookDocs) {
        const docId = `cb-${item.block.id}-doc-${item.doc.id}`;
        console.log('[Migration] Importing contentBlock doc:', item.doc.name);
        
        // Update status to importing
        setImportStatuses(prev => prev.map(s => 
          s.id === docId ? { ...s, status: 'importing' } : s
        ));

        try {
          // Get učební text slug for this block if it was created
          const blockUcebniTextSlug = ucebniTextSlugs.get(item.block.id);
          const result = await importContentBlockDocument(item.doc, item.block, item.chapter, item.book, accessToken, blockUcebniTextSlug);
          
          // Create worksheet menu item with extended worksheet data
          const worksheetMenuItem: MenuItem = {
            id: `imported-cb-${item.doc.id}-${Math.random().toString(36).slice(2, 8)}`,
            label: item.doc.name,
            slug: result.slug,
            type: 'worksheet',
            coverImage: result.coverImageUrl,
            extendedWorksheet: result.extendedWorksheet,
          };
          
          // Store in map for reliable lookup when building folder structure
          worksheetsByDocId.set(item.doc.id, worksheetMenuItem);
          
          if (shouldCreateWorkbook) {
            // Add as child to workbook
            workbookChildren.push(worksheetMenuItem);
          } else {
            // Single worksheet - add directly to menu
            importedMenuItems.push(worksheetMenuItem);
          }
          
          successCount++;
          
          // Update status to success
          setImportStatuses(prev => prev.map(s => 
            s.id === docId ? { ...s, status: 'success' } : s
          ));
        } catch (err: any) {
          const errorMessage = err.message || 'Neznámá chyba';
          const isAlreadyExists = errorMessage.includes('already exists') || errorMessage.includes('409');
          
          if (isAlreadyExists) {
            // Already exists - treat as partial success
            const slug = generateSlug(item.doc.name);
            const worksheetMenuItem: MenuItem = {
              id: `imported-cb-${item.doc.id}-${Math.random().toString(36).slice(2, 8)}`,
              label: item.doc.name,
              slug: slug,
              type: 'worksheet',
              coverImage: item.doc.previewUrl || '',
            };
            
            // Store in map for reliable lookup when building folder structure
            worksheetsByDocId.set(item.doc.id, worksheetMenuItem);
            
            if (shouldCreateWorkbook) {
              workbookChildren.push(worksheetMenuItem);
            } else {
              importedMenuItems.push(worksheetMenuItem);
            }
            successCount++;
            
            setImportStatuses(prev => prev.map(s => 
              s.id === docId ? { ...s, status: 'success', error: 'Stránka již existovala' } : s
            ));
          } else {
            errorCount++;
            console.error(`Error importing ${item.doc.name}:`, err);
            
            setImportStatuses(prev => prev.map(s => 
              s.id === docId ? { ...s, status: 'error', error: errorMessage } : s
            ));
          }
        }

        // Small delay between imports to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Check what the book has
      const hasContentBlocks = book.chapters.some(ch => ch.contentBlocks && ch.contentBlocks.length > 0);
      const hasLessons = book.chapters.some(ch => ch.knowledge && ch.knowledge.length > 0);
      
      console.log(`[Migration] Book "${book.name}" - hasContentBlocks: ${hasContentBlocks}, hasLessons: ${hasLessons}, worksheets: ${workbookChildren.length}`);
      
      // ========================================
      // 1. CREATE WORKBOOK (only worksheets)
      // ========================================
      if (workbookChildren.length > 0) {
        const workbookName = book.name; // Just the book name
        
        console.log(`[Migration] Creating WORKBOOK: ${workbookName} with ${workbookChildren.length} worksheets`);
        
        const workbookSlug = generateSlug(`pracovni-sesit-${book.name}`);
        
        // Helper to extract page number from label (e.g. "str. 2 Délka" -> 2, "str. 40 Celá čísla" -> 40)
        const extractPageNumber = (label: string): number | null => {
          const match = label.match(/str\.?\s*(\d+)/i);
          return match ? parseInt(match[1], 10) : null;
        };
        
        // Convert workbookChildren to workbookPages (references, not copies)
        const workbookPages: WorkbookPage[] = workbookChildren.map((child, index) => {
          const extractedPage = extractPageNumber(child.label);
          return {
            id: `page-${child.id}`,
            pageNumber: extractedPage || (index + 1), // Use extracted page or fallback to sequential
            worksheetId: child.id,
            worksheetSlug: child.slug || '',
            worksheetLabel: child.label,
            worksheetCover: child.coverImage,
          };
        })
        // Sort by page number
        .sort((a, b) => a.pageNumber - b.pageNumber);
        
        importedMenuItems.push({
          id: `imported-workbook-${targetCategory}-${book.id}-${Math.random().toString(36).slice(2, 8)}`,
          label: workbookName,
          slug: workbookSlug,
          type: 'workbook',
          icon: 'book',
          coverImage: book.imageUrl || '',
          workbookPages, // Pages are references to worksheets, not copies
          author: book.authors,
          eshopUrl: book.eshopUrl,
        });
        
        // Create page record for workbook (required for WorkbookView to render)
        try {
          console.log(`[Migration] Creating page for workbook: ${workbookSlug}`);
          const workbookPageResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                slug: workbookSlug,
                title: workbookName,
                category: targetCategory,
                documentType: 'workbook',
                type: 'workbook',
                featuredMedia: book.imageUrl || '',
                content: JSON.stringify({
                  author: book.authors,
                  eshopUrl: book.eshopUrl,
                }),
              })
            }
          );
          if (workbookPageResponse.ok) {
            console.log(`[Migration] ✓ Workbook page created: ${workbookSlug}`);
          } else {
            console.warn(`[Migration] Failed to create workbook page: ${workbookPageResponse.status}`);
          }
        } catch (err) {
          console.error(`[Migration] Error creating workbook page:`, err);
        }
      }
      
      // ========================================
      // 2. CREATE FOLDER (all content organized by contentBlocks)
      // ========================================
      if (hasContentBlocks) {
        console.log(`[Migration] Creating FOLDER for book: ${book.name}`);
        
        // Build folder structure: Book → Chapters → ContentBlocks
        const chapterFolders: MenuItem[] = [];
        
        for (const chapter of book.chapters) {
          const chapterBlocks = chapter.contentBlocks || [];
          if (chapterBlocks.length === 0) continue;
          
          const blockSubfolders: MenuItem[] = [];
          
          for (const block of chapterBlocks) {
            const blockChildren: MenuItem[] = [];
            
            // 1. Add učební text if exists
            const textSlug = ucebniTextSlugs.get(block.id);
            if (textSlug) {
              blockChildren.push({
                id: `folder-text-${block.id}`,
                label: 'Učební text',
                slug: textSlug,
                type: 'ucebni-text',
                icon: 'book-open',
              });
            }
            
            // 2. Add worksheets from this block's documents
            const blockDocs = bookDocs.filter(d => d.block.id === block.id);
            for (const docItem of blockDocs) {
              // Get worksheet from map (guaranteed to exist if import succeeded)
              const worksheetMenuItem = worksheetsByDocId.get(docItem.doc.id);
              
              if (worksheetMenuItem) {
                console.log(`[Migration] ✓ Found worksheet for doc ${docItem.doc.id}: ${worksheetMenuItem.label}`);
                blockChildren.push({
                  ...worksheetMenuItem,
                  id: `${worksheetMenuItem.id}-folder-${block.id}`,
                });
              } else {
                console.warn(`[Migration] ✗ Worksheet not found for doc ${docItem.doc.id} in worksheetsByDocId map (${worksheetsByDocId.size} items)`);
              }
              
              // 3. Add methodologies (from document)
              if (docItem.doc.methodicPdf) {
                const m = docItem.doc.methodicPdf as any;
                blockChildren.push({
                  id: `folder-method-${docItem.doc.id}`,
                  label: m.name || 'Metodika',
                  type: 'methodology',
                  icon: 'graduation-cap',
                  externalUrl: m.documentUrl || m.url || '',
                });
              }
              
              // 4. Add practices
              (docItem.doc.practices || []).forEach((p: any, idx: number) => {
                const practiceUrl = p.url || p.playableLink || '';
                blockChildren.push({
                  id: `folder-prac-${docItem.doc.id}-${idx}`,
                  label: p.name || `Procvičování ${idx + 1}`,
                  type: 'practice',
                  icon: 'play',
                  url: practiceUrl,
                  externalUrl: practiceUrl,
                });
              });
              
              // 5. Add tests
              (docItem.doc.tests || []).forEach((t: any, idx: number) => {
                const testUrl = t.url || t.playableLink || t.documentUrl || '';
                blockChildren.push({
                  id: `folder-test-${docItem.doc.id}-${idx}`,
                  label: t.name || `Test ${idx + 1}`,
                  type: 'test',
                  icon: 'file-check',
                  externalUrl: testUrl,
                });
              });
              
              // 6. Add exams (písemky)
              (docItem.doc.abcdTests || []).forEach((e: any, idx: number) => {
                const examUrl = e.url || e.playableLink || e.documentUrl || '';
                blockChildren.push({
                  id: `folder-exam-${docItem.doc.id}-${idx}`,
                  label: e.name || `Písemka ${idx + 1}`,
                  type: 'exam',
                  icon: 'file-text',
                  externalUrl: examUrl,
                });
              });
              
              // 7. Add interactive worksheets
              (docItem.doc.interactiveWorksheets || []).forEach((iw: any, idx: number) => {
                const iwUrl = iw.url || iw.playableLink || '';
                blockChildren.push({
                  id: `folder-iw-${docItem.doc.id}-${idx}`,
                  label: iw.name || `Interaktivní verze ${idx + 1}`,
                  type: 'interactive',
                  icon: 'play-circle',
                  externalUrl: iwUrl,
                });
              });
              
              // 8. Add bonuses
              (docItem.doc.bonusSheets || []).forEach((b: any, idx: number) => {
                blockChildren.push({
                  id: `folder-bonus-${docItem.doc.id}-${idx}`,
                  label: b.name || `Bonus ${idx + 1}`,
                  type: 'bonus',
                  icon: 'download',
                  externalUrl: b.documentUrl || b.url || '',
                });
              });
            }
            
            // Also add methodologies from block level (methodicalInspirationsPdf)
            ((block as any).methodicalInspirationsPdf || []).forEach((m: any, idx: number) => {
              blockChildren.push({
                id: `folder-method-block-${block.id}-${idx}`,
                label: m.name || `Metodika ${idx + 1}`,
                type: 'methodology',
                icon: 'graduation-cap',
                externalUrl: m.documentUrl || m.url || '',
              });
            });
            
            // Only add block subfolder if it has content
            if (blockChildren.length > 0) {
              const blockSlug = `folder-block-${block.id}`;
              blockSubfolders.push({
                id: blockSlug,
                slug: blockSlug, // Add slug for navigation
                label: block.name,
                type: 'folder',
                icon: 'folder',
                contentView: 'overview', // Default to overview sections
                children: blockChildren,
              });
              console.log(`[Migration] Block "${block.name}" has ${blockChildren.length} items`);
            }
          }
          
          // Add chapter folder if it has any blocks with content
          if (blockSubfolders.length > 0) {
            const chapterSlug = `folder-chapter-${chapter.id}`;
            chapterFolders.push({
              id: chapterSlug,
              slug: chapterSlug, // Add slug for navigation
              label: chapter.name,
              type: 'folder',
              icon: 'folder',
              contentView: 'overview', // Default to overview sections
              children: blockSubfolders,
            });
            console.log(`[Migration] Chapter "${chapter.name}" has ${blockSubfolders.length} blocks`);
          }
        }
        
        // Flatten if only one chapter - put blocks directly under book
        const folderSubfolders = chapterFolders.length === 1 
          ? chapterFolders[0].children || []
          : chapterFolders;
        
        // Create the main folder if we have any subfolders
        if (folderSubfolders.length > 0) {
          const folderName = book.name; // Just the book name
          const folderSlug = generateSlug(`slozka-${book.name}`);
          
          console.log(`[Migration] Creating FOLDER: ${folderName} with ${folderSubfolders.length} subfolders`);
          importedMenuItems.push({
            id: `imported-folder-${targetCategory}-${book.id}-${Math.random().toString(36).slice(2, 8)}`,
            label: folderName,
            slug: folderSlug,
            type: 'folder',
            coverImage: book.imageUrl || '',
            contentView: 'overview', // Default to overview sections
            children: folderSubfolders,
            author: book.authors,
            eshopUrl: book.eshopUrl,
          });
        }
      }
    }

    console.log(`[MigrationAgent] Import finished: ${successCount} success, ${errorCount} errors, ${importedMenuItems.length} menu items`);
    console.log(`[MigrationAgent] Menu items to add:`, importedMenuItems);
    console.log(`[MigrationAgent] Selected destination:`, selectedDestination);
    console.log(`[MigrationAgent] Current menu structure:`, menuStructure);

    // Update menu structure with imported items
    if (importedMenuItems.length > 0) {
      try {
        let updatedMenu = JSON.parse(JSON.stringify(menuStructure)); // Deep clone
        
        if (selectedDestination) {
          console.log(`[MigrationAgent] Adding to destination: ${selectedDestination}`);
          
          // Find the destination group and add items to it
          let found = false;
          const addToGroup = (items: MenuItem[]): MenuItem[] => {
            return items.map(item => {
              if (item.id === selectedDestination) {
                found = true;
                console.log(`[MigrationAgent] Found destination, adding ${importedMenuItems.length} items`);
                return {
                  ...item,
                  children: [...(item.children || []), ...importedMenuItems]
                };
              }
              if (item.children) {
                return {
                  ...item,
                  children: addToGroup(item.children)
                };
              }
              return item;
            });
          };
          updatedMenu = addToGroup(updatedMenu);
          
          if (!found) {
            console.warn(`[MigrationAgent] Destination ${selectedDestination} not found! Adding to root instead.`);
            updatedMenu = [...updatedMenu, ...importedMenuItems];
          }
        } else {
          console.log(`[MigrationAgent] Adding to root`);
          // Add to root
          updatedMenu = [...updatedMenu, ...importedMenuItems];
        }

        console.log(`[MigrationAgent] Updated menu:`, updatedMenu);

        // Process menu items to import boards (practices, tests, exams, interactive worksheets)
        console.log('[MigrationAgent] Processing boards for import...');
        await processMenuItemsForBoards(
          importedMenuItems,
          accessToken,
          (msg) => console.log(`[Migration] ${msg}`)
        );
        console.log('[MigrationAgent] Board processing complete');

        // Save updated menu
        const menuResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              menu: updatedMenu,
              category: targetCategory
            })
          }
        );

        console.log(`[MigrationAgent] Menu update response: ${menuResponse.status}`);
        
        if (menuResponse.ok) {
          setMenuStructure(updatedMenu);
          console.log('[MigrationAgent] Menu updated successfully!');
          toast.success(`Menu aktualizováno - přidáno ${importedMenuItems.length} položek do ${selectedDestination ? 'vybrané složky' : 'kořene'}`);
        } else {
          const errorText = await menuResponse.text();
          console.error('[MigrationAgent] Menu update failed:', errorText);
          toast.error('Nepodařilo se aktualizovat menu struktur');
        }
      } catch (err) {
        console.error('Error updating menu:', err);
        toast.error('Nepodařilo se aktualizovat menu');
      }
    }

    setImporting(false);
    
    if (successCount > 0) {
      toast.success(`Úspěšně importováno ${successCount} položek`);
      // Clear selection after successful import
      setSelectedItems(new Set());
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} položek se nepodařilo importovat`);
    }
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const getKnowledgeStats = (knowledge: LegacyKnowledge) => {
    const stats: string[] = [];
    const icons: string[] = [];
    
    // Content sections
    if (knowledge.description) icons.push('📝');
    if (knowledge.conclusion) icons.push('📖');
    if (knowledge.questions) icons.push('❓');
    if (knowledge.methodicalInspiration) icons.push('👨‍🏫');
    
    // Media
    if (knowledge.animation?.items?.length) {
      icons.push('🎬');
      stats.push(`${knowledge.animation.items.length} animací`);
    }
    if (knowledge.imageUrl) icons.push('🖼️');
    
    // PDFs - worksheet and solution
    if (knowledge.pdfUrl) icons.push('📄');
    if (knowledge.solutionUrl) icons.push('✅');
    
    // Documents & exercises
    if (knowledge.documents?.length) {
      stats.push(`${knowledge.documents.length} dok.`);
    }
    if (knowledge.practices?.length) {
      stats.push(`${knowledge.practices.length} cvičení`);
    }
    if (knowledge.tests?.length) {
      stats.push(`${knowledge.tests.length} testů`);
    }
    
    const iconString = icons.length > 0 ? icons.join('') + ' ' : '';
    const statsString = stats.length > 0 ? stats.join(' • ') : 'Pouze text';
    return iconString + statsString;
  };

  // Get stats for contentBlock (worksheet-style content)
  const getContentBlockStats = (block: LegacyContentBlock) => {
    const stats: string[] = [];
    const icons: string[] = [];
    
    // Content
    if (block.content && block.content.length > 50) icons.push('📝');
    if (block.imageUrl) icons.push('🖼️');
    if (block.contentImages?.length) {
      stats.push(`${block.contentImages.length} obr.`);
    }
    
    // Documents (worksheets)
    if (block.documents?.length) {
      icons.push('📄');
      stats.push(`${block.documents.length} prac. listů`);
    }
    
    // Methodical inspirations
    if (block.methodicalInspirationsPdf?.length) {
      icons.push('👨‍🏫');
      stats.push(`${block.methodicalInspirationsPdf.length} metod.`);
    }
    
    // Related quizzes
    if (block.relatedQuizzes?.length) {
      icons.push('🎮');
      stats.push(`${block.relatedQuizzes.length} kvízů`);
    }
    
    const iconString = icons.length > 0 ? icons.join('') + ' ' : '';
    const statsString = stats.length > 0 ? stats.join(' • ') : 'Pouze text';
    return iconString + statsString;
  };

  // Get stats for contentBlock document
  const getDocumentStats = (doc: LegacyContentBlockDocument) => {
    const stats: string[] = [];
    const icons: string[] = [];
    
    if (doc.documentUrl) icons.push('📄');
    if (doc.solutionUrl) icons.push('✅');
    if (doc.previewUrl) icons.push('🖼️');
    
    if (doc.interactiveWorksheets?.length) {
      icons.push('🎯');
      stats.push(`${doc.interactiveWorksheets.length} interakt.`);
    }
    if (doc.practices?.length) {
      icons.push('🎮');
      stats.push(`${doc.practices.length} cvičení`);
    }
    if (doc.tests?.length) {
      stats.push(`${doc.tests.length} testů`);
    }
    
    const iconString = icons.length > 0 ? icons.join('') + ' ' : '';
    const statsString = stats.length > 0 ? stats.join(' • ') : doc.type === 'worksheet' ? 'Pracovní list' : doc.type;
    return iconString + statsString;
  };

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="min-h-screen bg-[#EFF1F8]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Migrační Agent</h1>
                <p className="text-sm text-slate-500">Import obsahu ze starého API</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Logout button */}
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  borderRadius: '8px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              >
                Odhlásit se
              </button>
              
              {selectedItems.size > 0 && (() => {
                // Check if selected books match target category
                const selectedBookNames = books
                  .filter(book => {
                    // Check if any item from this book is selected
                    const hasSelectedKnowledge = book.chapters.some(ch => 
                      ch.knowledge?.some(k => selectedItems.has(`k-${k.id}`))
                    );
                    const hasSelectedDoc = book.chapters.some(ch =>
                      ch.contentBlocks?.some(b => 
                        b.documents?.some(d => selectedItems.has(`doc-${d.id}`))
                      )
                    );
                    const hasSelectedText = book.chapters.some(ch =>
                      ch.contentBlocks?.some(b => selectedItems.has(`text-${b.id}`))
                    );
                    return hasSelectedKnowledge || hasSelectedDoc || hasSelectedText;
                  })
                  .map(b => b.name.toLowerCase());
                
                const hasFyzika = selectedBookNames.some(n => n.includes('fyzika'));
                const hasMatematika = selectedBookNames.some(n => n.includes('matematik'));
                const hasChemie = selectedBookNames.some(n => n.includes('chemie'));
                const hasPriroda = selectedBookNames.some(n => n.includes('přírodopis') || n.includes('prirodopis'));
                
                const mismatch = (hasFyzika && targetCategory !== 'fyzika') ||
                                (hasMatematika && targetCategory !== 'matematika') ||
                                (hasChemie && targetCategory !== 'chemie') ||
                                (hasPriroda && targetCategory !== 'prirodopis');
                
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {mismatch && (
                      <div style={{
                        padding: '6px 12px',
                        backgroundColor: '#fef2f2',
                        border: '2px solid #ef4444',
                        borderRadius: '8px',
                        color: '#dc2626',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <AlertCircle className="w-4 h-4" />
                        ⚠️ Vybrané knihy neodpovídají kategorii {targetCategory.toUpperCase()}!
                      </div>
                    )}
                    <button
                      onClick={startImport}
                      disabled={importing}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: mismatch ? '#ef4444' : '#7c3aed',
                        color: 'white',
                        borderRadius: '8px',
                        fontWeight: 500,
                        border: 'none',
                        cursor: importing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: importing ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => !importing && (e.currentTarget.style.backgroundColor = mismatch ? '#dc2626' : '#6d28d9')}
                      onMouseLeave={(e) => !importing && (e.currentTarget.style.backgroundColor = mismatch ? '#ef4444' : '#7c3aed')}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Importuji...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          {mismatch ? '⚠️ ' : ''}Importovat ({selectedItems.size})
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* API Configuration */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-500" />
            Konfigurace API
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                User Code
              </label>
              <input
                type="text"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ID knih (čárkou oddělené)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bookIds}
                  onChange={(e) => setBookIds(e.target.value)}
                  placeholder="44, 45, 46"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={fetchAllBooks}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4E5871',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: loading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#3d4660')}
                  onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4E5871')}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Načíst
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ⚠️ Cílová kategorie (předmět) - DŮLEŽITÉ!
              </label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                style={{
                  padding: '12px 16px',
                  border: targetCategory === 'fyzika' ? '3px solid #3b82f6' : 
                         targetCategory === 'matematika' ? '3px solid #22c55e' :
                         targetCategory === 'chemie' ? '3px solid #f97316' :
                         '3px solid #8b5cf6',
                  borderRadius: '8px',
                  width: '100%',
                  backgroundColor: targetCategory === 'fyzika' ? '#eff6ff' : 
                                  targetCategory === 'matematika' ? '#f0fdf4' :
                                  targetCategory === 'chemie' ? '#fff7ed' :
                                  '#faf5ff',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                <option value="fyzika">📘 FYZIKA</option>
                <option value="chemie">🧪 CHEMIE</option>
                <option value="prirodopis">🌿 PŘÍRODOPIS</option>
                <option value="matematika">📐 MATEMATIKA</option>
                <option value="knihovna-vividbooks">📚 Knihovna Vividbooks</option>
              </select>
              <div 
                style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: targetCategory === 'fyzika' ? '#dbeafe' : 
                                  targetCategory === 'matematika' ? '#dcfce7' :
                                  targetCategory === 'chemie' ? '#ffedd5' :
                                  '#f3e8ff',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                📁 Data budou uložena do: <strong>{targetCategory.toUpperCase()}</strong>
              </div>
            </div>
            
            {/* Download files option */}
            <div className="mt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downloadFiles}
                  onChange={(e) => setDownloadFiles(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-slate-700">Stáhnout soubory do storage</span>
                  <p className="text-sm text-slate-500">
                    PDF, obrázky a Lottie animace budou staženy do Supabase storage
                  </p>
                </div>
              </label>
            </div>
            
            {/* Overwrite existing option */}
            <div className="mt-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <span className="font-medium text-slate-700">Přepsat existující dokumenty</span>
                  <p className="text-sm text-slate-500">
                    Pokud dokument se stejným slugem již existuje, bude přepsán
                  </p>
                </div>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cílová složka v menu
              </label>
              {loadingMenu ? (
                <div className="flex items-center gap-2 text-slate-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Načítám menu...
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedDestination || ''}
                    onChange={(e) => setSelectedDestination(e.target.value || null)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      width: '100%',
                      backgroundColor: 'white',
                    }}
                  >
                    <option value="">📁 Kořen (hlavní úroveň)</option>
                    {getGroupsFromMenu(menuStructure).map(group => (
                      <option key={group.id} value={group.id}>
                        {'  '.repeat(group.depth)}📁 {group.path}
                      </option>
                    ))}
                  </select>
                  
                  {/* New group button */}
                  {!showNewGroupInput ? (
                    <button
                      onClick={() => setShowNewGroupInput(true)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FolderOpen className="w-4 h-4" />
                      Vytvořit novou složku
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Název nové složky..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={async () => {
                          if (!newGroupName.trim()) return;
                          
                          const { data: { session } } = await getSupabaseSession();
                          if (!session?.access_token) {
                            toast.error('Nejste přihlášeni');
                            return;
                          }
                          
                          const newGroup: MenuItem = {
                            id: `group-${Date.now()}`,
                            label: newGroupName.trim(),
                            type: 'group',
                            children: []
                          };
                          
                          let updatedMenu: MenuItem[];
                          if (selectedDestination) {
                            // Add to selected destination
                            const addToParent = (items: MenuItem[]): MenuItem[] => {
                              return items.map(item => {
                                if (item.id === selectedDestination) {
                                  return { ...item, children: [...(item.children || []), newGroup] };
                                }
                                if (item.children) {
                                  return { ...item, children: addToParent(item.children) };
                                }
                                return item;
                              });
                            };
                            updatedMenu = addToParent(menuStructure);
                          } else {
                            // Add to root
                            updatedMenu = [...menuStructure, newGroup];
                          }
                          
                          // Save menu
                          await fetch(
                            `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
                            {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`
                              },
                              body: JSON.stringify({ menu: updatedMenu, category: targetCategory })
                            }
                          );
                          
                          setMenuStructure(updatedMenu);
                          setSelectedDestination(newGroup.id);
                          setNewGroupName('');
                          setShowNewGroupInput(false);
                          toast.success(`Složka "${newGroupName}" vytvořena`);
                        }}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#22c55e',
                          color: 'white',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setShowNewGroupInput(false);
                          setNewGroupName('');
                        }}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Asset Info Section */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 mb-6 border border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-purple-800">Automatické ukládání animací</h3>
              <p className="text-sm text-purple-600">
                Lottie animace se při migraci automaticky ukládají do <code className="px-1 py-0.5 bg-purple-100 rounded text-xs">vividbooks_assets</code> a jsou dostupné v Asset Pickeru.
              </p>
            </div>
          </div>
          
          {/* Manual extraction for existing pages */}
          <details className="mt-3">
            <summary className="text-xs text-purple-500 cursor-pointer hover:text-purple-700">
              Extrakce z již migrovaných stránek (jednorázově)
            </summary>
            <div className="mt-2 pt-2 border-t border-purple-200">
              <button
                onClick={extractAssetsFromPages}
                disabled={extractingAssets}
                className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 flex items-center gap-2"
              >
                {extractingAssets ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Extrahuji...
                  </>
                ) : (
                  <>
                    <Film className="w-3 h-3" />
                    Extrahovat z existujících stránek
                  </>
                )}
              </button>
              {extractionProgress && (
                <p className="text-xs text-purple-500 mt-2">
                  Zpracováno: {extractionProgress.processed}/{extractionProgress.total} • 
                  Uloženo: {extractionProgress.saved} • 
                  Chyb: {extractionProgress.errors}
                </p>
              )}
            </div>
          </details>
        </div>

        {/* Import Progress */}
        {importStatuses.length > 0 && (
          <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-medium text-slate-800 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-slate-500" />
              Průběh importu
            </h2>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {importStatuses.map((status) => (
                <div 
                  key={status.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    status.status === 'success' ? 'bg-green-50' :
                    status.status === 'error' ? 'bg-red-50' :
                    status.status === 'importing' ? 'bg-blue-50' :
                    'bg-slate-50'
                  }`}
                >
                  {status.status === 'pending' && <div className="w-4 h-4 rounded-full bg-slate-300" />}
                  {status.status === 'importing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {status.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {status.status === 'error' && <X className="w-4 h-4 text-red-500" />}
                  
                  <span className="flex-1 text-sm truncate">{status.name}</span>
                  
                  {status.error && (
                    <span className="text-xs text-red-600">{status.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Books List */}
        {books.length > 0 && (
          <div className="space-y-4">
            {books.map((book) => (
              <div key={book.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Book Header */}
                <div 
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleBook(book.id)}
                >
                  <div className="w-16 h-16 rounded-lg bg-indigo-100 flex items-center justify-center overflow-hidden">
                    {book.imageUrl ? (
                      <img src={book.imageUrl} alt={book.name} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-8 h-8 text-indigo-500" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800">{book.name}</h3>
                    <p className="text-sm text-slate-500">{book.subject?.name} • {book.chapters.length} kapitol</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-slate-400">{book.authors}</p>
                      {/* PDF/Solution counts */}
                      {(() => {
                        let pdfCount = 0;
                        let solutionCount = 0;
                        let worksheetCount = 0;
                        book.chapters.forEach(ch => {
                          // Count from knowledge items
                          ch.knowledge?.forEach(k => {
                            if (k.pdfUrl) pdfCount++;
                            if (k.solutionUrl) solutionCount++;
                          });
                          // Count from contentBlocks
                          ch.contentBlocks?.forEach(block => {
                            block.documents?.forEach(doc => {
                              worksheetCount++;
                              if (doc.solutionUrl) solutionCount++;
                            });
                          });
                        });
                        return (
                          <>
                            {pdfCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                📄 {pdfCount}
                              </span>
                            )}
                            {worksheetCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                📋 {worksheetCount} prac. listů
                              </span>
                            )}
                            {solutionCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                ✅ {solutionCount}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Book Checkbox */}
                    {(() => {
                      const state = getBookSelectionState(book);
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBookSelection(book); }}
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '4px',
                            border: `2px solid ${state !== 'none' ? '#7c3aed' : '#cbd5e1'}`,
                            backgroundColor: state === 'all' ? '#7c3aed' : state === 'partial' ? '#c4b5fd' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          {state === 'all' && <Check className="w-4 h-4 text-white" />}
                          {state === 'partial' && <div style={{ width: 10, height: 3, backgroundColor: '#7c3aed', borderRadius: 1 }} />}
                        </button>
                      );
                    })()}
                    
                    {expandedBooks.has(book.id) ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
                
                {/* Chapters */}
                {expandedBooks.has(book.id) && (
                  <div className="border-t border-slate-100">
                    {book.chapters.map((chapter) => (
                      <div key={chapter.id}>
                        {/* Chapter Header */}
                        <div 
                          className="px-6 py-3 bg-slate-50 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => toggleChapter(`${book.id}-${chapter.id}`)}
                        >
                          {/* Chapter Checkbox */}
                          {(() => {
                            const state = getChapterSelectionState(chapter);
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleChapterSelection(chapter); }}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '4px',
                                  border: `2px solid ${state !== 'none' ? '#7c3aed' : '#cbd5e1'}`,
                                  backgroundColor: state === 'all' ? '#7c3aed' : state === 'partial' ? '#c4b5fd' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  padding: 0,
                                  flexShrink: 0,
                                }}
                              >
                                {state === 'all' && <Check className="w-3 h-3 text-white" />}
                                {state === 'partial' && <div style={{ width: 8, height: 2, backgroundColor: '#7c3aed', borderRadius: 1 }} />}
                              </button>
                            );
                          })()}
                          
                          {expandedChapters.has(`${book.id}-${chapter.id}`) ? (
                            <FolderOpen className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Folder className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="font-medium text-slate-700">{chapter.name}</span>
                          <span className="text-xs text-slate-400">
                            {(() => {
                              const knowledgeCount = chapter.knowledge?.length || 0;
                              const worksheetCount = chapter.contentBlocks?.reduce((acc, b) => acc + (b.documents?.length || 0), 0) || 0;
                              const contentBlockCount = chapter.contentBlocks?.length || 0;
                              
                              if (knowledgeCount > 0) {
                                return `${knowledgeCount} lekcí`;
                              } else if (worksheetCount > 0) {
                                return `${worksheetCount} prac. listů`;
                              } else if (contentBlockCount > 0) {
                                return `${contentBlockCount} bloků`;
                              } else {
                                return 'Prázdná kapitola';
                              }
                            })()}
                          </span>
                          
                          {/* PDF/Solution counts for chapter */}
                          {(() => {
                            const pdfCount = chapter.knowledge?.filter(k => k.pdfUrl).length || 0;
                            const solutionCount = chapter.knowledge?.filter(k => k.solutionUrl).length || 0;
                            let worksheetCount = 0;
                            let worksheetSolutionCount = 0;
                            chapter.contentBlocks?.forEach(block => {
                              worksheetCount += block.documents?.length || 0;
                              worksheetSolutionCount += block.documents?.filter(d => d.solutionUrl).length || 0;
                            });
                            return (
                              <>
                                {pdfCount > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                                    📄 {pdfCount}
                                  </span>
                                )}
                                {worksheetCount > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-xs">
                                    📋 {worksheetCount}
                                  </span>
                                )}
                                {(solutionCount + worksheetSolutionCount) > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-xs">
                                    ✅ {solutionCount + worksheetSolutionCount}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                          
                          {/* Show count of selected items */}
                          {(() => {
                            const chapterIds = getChapterItemIds(chapter);
                            const selectedCount = chapterIds.filter(id => selectedItems.has(id)).length;
                            if (selectedCount > 0 && selectedCount < chapterIds.length) {
                              return (
                                <span className="text-xs text-indigo-600 font-medium">
                                  ({selectedCount} vybráno)
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        
                        {/* Chapter Items (Knowledge + ContentBlocks) */}
                        {expandedChapters.has(`${book.id}-${chapter.id}`) && (
                          <div className="pl-10">
                            {/* Knowledge Items (lessons with description, animation, etc.) */}
                            {chapter.knowledge?.map((knowledge) => {
                              const isSelected = selectedItems.has(`k-${knowledge.id}`);
                              
                              return (
                                <div 
                                  key={`k-${knowledge.id}`}
                                  className={`px-4 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                                    isSelected ? 'bg-indigo-50' : ''
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <button
                                    onClick={() => toggleSelection(`k-${knowledge.id}`)}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '4px',
                                      border: `2px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`,
                                      backgroundColor: isSelected ? '#7c3aed' : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: 0,
                                    }}
                                  >
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                  
                                  {/* Thumbnail */}
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {knowledge.imageUrl ? (
                                      <img src={knowledge.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <FileText className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>
                                  
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-700 truncate">{knowledge.name}</p>
                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                      <p className="text-xs text-slate-400">{getKnowledgeStats(knowledge)}</p>
                                      {/* PDF badges */}
                                      {knowledge.pdfUrl && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                          📄 Pracovní list
                                        </span>
                                      )}
                                      {knowledge.solutionUrl && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                          ✅ Řešení
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Preview Button */}
                                  <button
                                    onClick={() => {
                                      setPreviewItem(knowledge);
                                      setPreviewContext({ chapter, book });
                                    }}
                                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                                    title="Náhled"
                                  >
                                    <Eye className="w-4 h-4 text-slate-500" />
                                  </button>
                                </div>
                              );
                            })}
                            
                            {/* ContentBlocks (worksheet-only chapters) */}
                            {chapter.contentBlocks?.map((block) => (
                              <div key={`cb-${block.id}`}>
                                {/* Block header - shows as a section */}
                                {block.documents && block.documents.length > 0 && (
                                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                                    <div className="flex items-center gap-2">
                                      <span className="text-amber-600 text-sm font-medium">📋 {block.name}</span>
                                      <span className="text-xs text-amber-500">{block.documents.length} pracovních listů</span>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Documents within the block */}
                                {block.documents?.map((doc) => {
                                  const docId = `cb-${block.id}-doc-${doc.id}`;
                                  const isSelected = selectedItems.has(docId);
                                  
                                  return (
                                    <div 
                                      key={docId}
                                      className={`px-4 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3 hover:bg-slate-50 transition-colors ml-4 ${
                                        isSelected ? 'bg-indigo-50' : ''
                                      }`}
                                    >
                                      {/* Checkbox */}
                                      <button
                                        onClick={() => toggleSelection(docId)}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          borderRadius: '4px',
                                          border: `2px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`,
                                          backgroundColor: isSelected ? '#7c3aed' : 'transparent',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          padding: 0,
                                        }}
                                      >
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                      </button>
                                      
                                      {/* Thumbnail */}
                                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {doc.previewUrl ? (
                                          <img src={doc.previewUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <FileText className="w-5 h-5 text-amber-600" />
                                        )}
                                      </div>
                                      
                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-700 truncate">{doc.name}</p>
                                        <div className="flex items-center gap-2 flex-wrap mt-1">
                                          <p className="text-xs text-slate-400">{getDocumentStats(doc)}</p>
                                          {doc.solutionUrl && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                              ✅ Řešení
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Preview Button */}
                                      <button
                                        onClick={() => {
                                          // Preview contentBlock document
                                          setPreviewItem({ ...doc, _type: 'contentBlockDoc', _block: block } as any);
                                          setPreviewContext({ chapter, book });
                                        }}
                                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                                        title="Náhled"
                                      >
                                        <Eye className="w-4 h-4 text-slate-500" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && books.length === 0 && !error && (
          <div className="bg-white rounded-xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">Žádné knihy nenačteny</h3>
            <p className="text-slate-400">
              Zadejte ID knih a klikněte na "Načíst" pro zobrazení obsahu ze starého API.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl p-12 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-600">Načítám knihy...</p>
          </div>
        )}
      </div>

      {/* Preview Modal - Full API Data */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800 text-lg">{previewItem.name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">ID: {previewItem.id}</code>
                  {previewContext?.chapter && (
                    <>
                      <span className="text-slate-300">•</span>
                      <code className="bg-amber-100 px-2 py-0.5 rounded text-xs text-amber-700">Chapter: {previewContext.chapter.id}</code>
                    </>
                  )}
                  {previewContext?.book && (
                    <>
                      <span className="text-slate-300">•</span>
                      <code className="bg-blue-100 px-2 py-0.5 rounded text-xs text-blue-700">Book: {previewContext.book.id}</code>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewItem(null);
                  setPreviewContext(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Images Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previewItem.imageUrl && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Hlavní obrázek (imageUrl)</p>
                    <img 
                      src={previewItem.imageUrl} 
                      alt={previewItem.name}
                      className="w-full h-48 object-contain rounded-lg bg-slate-100 border"
                    />
                    <p className="text-xs text-slate-400 mt-1 truncate">{previewItem.imageUrl}</p>
                  </div>
                )}
                {/* Referenční a target obrázky - SKIPPED */}
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Popis (description) - HTML</p>
                <div className="p-4 bg-slate-50 rounded-lg border">
                  <div 
                    className="prose prose-slate prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewItem.description }}
                  />
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Zobrazit zdrojový HTML</summary>
                  <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto">
                    {previewItem.description}
                  </pre>
                </details>
              </div>

              {/* Animation Section */}
              {previewItem.animation && (
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-medium text-indigo-800 mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Animace
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Typ:</span> {previewItem.animation.type}</p>
                    {previewItem.animation.audioUrl && (
                      <p><span className="font-medium">Audio:</span> <a href={previewItem.animation.audioUrl} target="_blank" className="text-indigo-600 underline">Přehrát</a></p>
                    )}
                    {previewItem.animation.introAnimationUrl && (
                      <p><span className="font-medium">Intro animace:</span> <a href={previewItem.animation.introAnimationUrl} target="_blank" className="text-indigo-600 underline">Zobrazit</a></p>
                    )}
                    {previewItem.animation.items && previewItem.animation.items.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium mb-2">Kroky animace ({previewItem.animation.items.length}):</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {previewItem.animation.items.map((item, idx) => (
                            <div key={idx} className="p-2 bg-white rounded border text-xs">
                              <p><span className="font-medium">Krok {idx + 1}:</span> ID {item.id}</p>
                              <p className="truncate"><span className="font-medium">URL:</span> {item.animationUrl}</p>
                              <p><span className="font-medium">Loop:</span> {item.isLoop ? 'Ano' : 'Ne'}</p>
                              {item.audioUrl && <p><span className="font-medium">Audio:</span> {item.audioUrl}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Practices */}
              {previewItem.practices && previewItem.practices.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-800 mb-3">Cvičení ({previewItem.practices.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {previewItem.practices.map((p: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border text-xs">
                        <p><span className="font-medium">Název:</span> {p.name || p.title || `Cvičení ${idx + 1}`}</p>
                        {p.type && <p><span className="font-medium">Typ:</span> {p.type}</p>}
                        {p.link && <p><span className="font-medium">Link:</span> <a href={p.link} target="_blank" className="text-green-600 underline truncate block">{p.link}</a></p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tests */}
              {previewItem.tests && previewItem.tests.length > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-800 mb-3">Testy ({previewItem.tests.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {previewItem.tests.map((t: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border text-xs">
                        <p><span className="font-medium">Název:</span> {t.name || t.title || `Test ${idx + 1}`}</p>
                        {t.type && <p><span className="font-medium">Typ:</span> {t.type}</p>}
                        {t.link && <p><span className="font-medium">Link:</span> <a href={t.link} target="_blank" className="text-purple-600 underline truncate block">{t.link}</a></p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ABCD Tests */}
              {previewItem.abcdTests && previewItem.abcdTests.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="font-medium text-amber-800 mb-3">ABCD Testy ({previewItem.abcdTests.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {previewItem.abcdTests.map((t: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border text-xs">
                        <p><span className="font-medium">Název:</span> {t.name || t.title || `ABCD Test ${idx + 1}`}</p>
                        {t.type && <p><span className="font-medium">Typ:</span> {t.type}</p>}
                        {t.link && <p><span className="font-medium">Link:</span> <a href={t.link} target="_blank" className="text-amber-600 underline truncate block">{t.link}</a></p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Minigames */}
              {previewItem.minigames && previewItem.minigames.length > 0 && (
                <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                  <h4 className="font-medium text-pink-800 mb-3">Minihry ({previewItem.minigames.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {previewItem.minigames.map((m: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border text-xs">
                        <p><span className="font-medium">Název:</span> {m.name || m.title || `Minihra ${idx + 1}`}</p>
                        {m.type && <p><span className="font-medium">Typ:</span> {m.type}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bonus Sheets */}
              {previewItem.bonusSheets && previewItem.bonusSheets.length > 0 && (
                <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                  <h4 className="font-medium text-cyan-800 mb-3">Bonusové listy ({previewItem.bonusSheets.length})</h4>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                    {JSON.stringify(previewItem.bonusSheets, null, 2)}
                  </pre>
                </div>
              )}

              {/* Conclusion - Závěr */}
              {previewItem.conclusion && (
                <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <h4 className="font-medium text-teal-800 mb-3">Závěr</h4>
                  <div 
                    className="prose prose-slate prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewItem.conclusion }}
                  />
                </div>
              )}

              {/* Questions - Otázky */}
              {previewItem.questions && (
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-orange-800 mb-3">Otázky k zamyšlení</h4>
                  <div 
                    className="prose prose-slate prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewItem.questions }}
                  />
                </div>
              )}

              {/* Answers - Odpovědi */}
              {previewItem.answers && (
                <div className="p-4 bg-lime-50 rounded-lg border border-lime-200">
                  <h4 className="font-medium text-lime-800 mb-3">Odpovědi</h4>
                  <div 
                    className="prose prose-slate prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewItem.answers }}
                  />
                </div>
              )}

              {/* Methodical Inspiration - Metodická inspirace */}
              {previewItem.methodicalInspiration && (
                <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                  <h4 className="font-medium text-violet-800 mb-3">Metodická inspirace</h4>
                  <div 
                    className="prose prose-slate prose-sm max-w-none max-h-60 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: previewItem.methodicalInspiration }}
                  />
                </div>
              )}

              {/* Documents - Dokumenty */}
              {previewItem.documents && previewItem.documents.length > 0 && (
                <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
                  <h4 className="font-medium text-sky-800 mb-3">Dokumenty ({previewItem.documents.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {previewItem.documents.map((doc: LegacyDocument) => (
                      <div key={doc.id} className="p-3 bg-white rounded-lg border flex gap-3">
                        {doc.previewUrl && (
                          <img 
                            src={doc.previewUrl} 
                            alt={doc.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{doc.name}</p>
                          <p className="text-xs text-slate-500">{doc.type}</p>
                          <a 
                            href={doc.documentUrl} 
                            target="_blank" 
                            className="text-xs text-sky-600 underline"
                          >
                            Stáhnout
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PDFs */}
              {(previewItem.pdfUrl || previewItem.extendedPdfUrl || previewItem.methodicalInspirationPdfUrl) && (
                <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
                  <h4 className="font-medium text-rose-800 mb-3">PDF ke stažení</h4>
                  <div className="flex flex-wrap gap-2">
                    {previewItem.pdfUrl && (
                      <a 
                        href={previewItem.pdfUrl} 
                        target="_blank" 
                        className="px-3 py-1.5 bg-white rounded border text-sm text-rose-700 hover:bg-rose-100"
                      >
                        📥 Pracovní list
                      </a>
                    )}
                    {previewItem.extendedPdfUrl && (
                      <a 
                        href={previewItem.extendedPdfUrl} 
                        target="_blank" 
                        className="px-3 py-1.5 bg-white rounded border text-sm text-rose-700 hover:bg-rose-100"
                      >
                        📥 Rozšířený pracovní list
                      </a>
                    )}
                    {previewItem.methodicalInspirationPdfUrl && (
                      <a 
                        href={previewItem.methodicalInspirationPdfUrl} 
                        target="_blank" 
                        className="px-3 py-1.5 bg-white rounded border text-sm text-rose-700 hover:bg-rose-100"
                      >
                        📥 Metodická inspirace
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Legacy IDs */}
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <h4 className="font-medium text-indigo-700 mb-3">🔗 Legacy ID systém</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p><span className="font-medium text-indigo-600">Knowledge ID:</span> <code className="bg-indigo-100 px-1 rounded">{previewItem.id}</code></p>
                  {previewContext?.chapter && (
                    <p><span className="font-medium text-indigo-600">Chapter ID:</span> <code className="bg-indigo-100 px-1 rounded">{previewContext.chapter.id}</code></p>
                  )}
                  {previewContext?.book && (
                    <p><span className="font-medium text-indigo-600">Book ID:</span> <code className="bg-indigo-100 px-1 rounded">{previewContext.book.id}</code></p>
                  )}
                  {previewContext?.book?.subject && (
                    <p><span className="font-medium text-indigo-600">Subject ID:</span> <code className="bg-indigo-100 px-1 rounded">{previewContext.book.subject.id}</code></p>
                  )}
                </div>
                {previewContext && (
                  <div className="mt-2 pt-2 border-t border-indigo-200 text-xs text-indigo-600">
                    <p><span className="font-medium">Cesta:</span> {previewContext.book?.subject?.name} → {previewContext.book?.name} → {previewContext.chapter?.name}</p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="p-4 bg-slate-100 rounded-lg">
                <h4 className="font-medium text-slate-700 mb-3">Metadata</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p><span className="font-medium">Jazyk:</span> {previewItem.languageCode || 'N/A'}</p>
                  <p><span className="font-medium">Demo:</span> {previewItem.isDemo ? 'Ano' : 'Ne'}</p>
                  <p><span className="font-medium">Disabled:</span> {previewItem.disabled ? 'Ano' : 'Ne'}</p>
                  <p><span className="font-medium">Textbook ID:</span> {previewItem.textbookId || 'N/A'}</p>
                  <p><span className="font-medium">Vytvořeno učitelem:</span> {previewItem.createdByTeacher ? 'Ano' : 'Ne'}</p>
                  <p><span className="font-medium">RVP:</span> {previewItem.isRvp ? 'Ano' : 'Ne'}</p>
                  <p><span className="font-medium">Jen metodika:</span> {previewItem.methodicsOnly ? 'Ano' : 'Ne'}</p>
                  {previewItem.relatedKnowledgeIds && previewItem.relatedKnowledgeIds.length > 0 && (
                    <p className="col-span-2"><span className="font-medium">Související lekce:</span> {previewItem.relatedKnowledgeIds.join(', ')}</p>
                  )}
                  {previewItem.solutionUrl && (
                    <p className="col-span-2"><span className="font-medium">Řešení:</span> <a href={previewItem.solutionUrl} target="_blank" className="text-blue-600 underline">{previewItem.solutionUrl}</a></p>
                  )}
                  {previewItem.methodicPdf && (
                    <p className="col-span-2"><span className="font-medium">Metodika PDF:</span> <a href={previewItem.methodicPdf} target="_blank" className="text-blue-600 underline">{previewItem.methodicPdf}</a></p>
                  )}
                </div>
              </div>

              {/* Raw JSON */}
              <details>
                <summary className="text-sm font-medium text-slate-600 cursor-pointer hover:text-slate-800">
                  Zobrazit kompletní JSON data
                </summary>
                <pre className="mt-2 p-4 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(previewItem, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

