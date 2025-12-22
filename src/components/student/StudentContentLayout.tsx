/**
 * StudentContentLayout - Student's file management interface
 * 
 * Mirrors the teacher's MyContentLayout design exactly
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Loader2,
  Moon,
  Sun,
  Menu,
  X,
  MoreVertical,
  Trash2,
  Pencil,
  Grid3X3,
  List,
  ArrowUpDown,
  Check,
  PanelLeft,
  PanelLeftClose,
  LayoutGrid,
  Copy,
  CheckSquare,
  Square,
  Send,
  CheckCircle,
  Share2,
} from 'lucide-react';
import VividLogo from '../../imports/Group70';
import { ToolsMenu } from '../ToolsMenu';
import { ToolsDropdown } from '../ToolsDropdown';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import {
  StudentContentItem,
  getStudentContent,
  addStudentContentItem,
  createStudentFolder,
  deleteStudentContentItem,
  updateStudentContentItem,
  syncStudentContentToCloud,
} from '../../utils/student-content-sync';
import {
  StudentAssignment,
  StudentSubmission,
} from '../../types/student-assignment';
import {
  getAssignmentsForStudent,
  getStudentSubmissions,
} from '../../utils/student-assignments';
import {
  SharedFolder,
  TeacherContentItem,
  getSharedFoldersForClass,
  getFolderContentsFromCloud,
  getFolderFromCloud,
} from '../../utils/teacher-content-sync';
import { toast } from 'sonner';
import { database } from '../../utils/firebase-config';
import { ref, set, get } from 'firebase/database';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface StudentContentLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// SVG Path for folder shape (same as teacher's view)
const FOLDER_BACK_PATH = "M6.31652 12.5701C6.31652 5.62783 11.9444 0 18.8866 0H60.976C65.4295 0 69.5505 2.35648 71.8093 6.19466L73.4384 8.96289C75.6972 12.8011 79.8183 15.1575 84.2718 15.1575H156.69C163.632 15.1575 169.26 20.7854 169.26 27.7277V133.953C169.26 140.895 163.632 146.523 156.69 146.523H18.8867C11.9444 146.523 6.31652 140.895 6.31652 133.953V12.5701Z";

// Predefined folder colors (same as teacher's view)
const FOLDER_COLORS = [
  '#bbf7d0', // green
  '#bfdbfe', // blue
  '#fde68a', // yellow
  '#fecaca', // red
  '#e9d5ff', // purple
  '#fed7aa', // orange
  '#a5f3fc', // cyan
  '#fbcfe8', // pink
];

// Folder Card Component for Student (matching teacher's design)
interface StudentFolderCardProps {
  item: StudentContentItem & { isShared?: boolean };
  onClick: () => void;
  onMenuClick?: (action: 'rename' | 'delete') => void;
}

const StudentFolderCard = ({ item, onClick, onMenuClick }: StudentFolderCardProps) => {
  const color = FOLDER_COLORS[0]; // Default to green, could be customized
  const filterId = `filter-student-${item.id}`;
  
  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-2 group cursor-pointer transition-all duration-200"
      style={{ width: '126px' }}
    >
      <div className="relative w-full transition-transform group-hover:-translate-y-1 duration-200" style={{ aspectRatio: '173/147' }}>
        {/* Menu button - only for non-shared folders */}
        {!item.isShared && onMenuClick && (
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm text-slate-500 hover:text-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMenuClick('rename'); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Přejmenovat
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-600 focus:text-red-600"
                  onClick={(e) => { e.stopPropagation(); onMenuClick('delete'); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Smazat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Shared indicator - for shared folders */}
        {item.isShared && (
          <div className="absolute top-2 right-2 z-10">
            <div className="p-1.5 rounded-full bg-purple-500 shadow-md">
              <Share2 className="h-3 w-3 text-white" />
            </div>
          </div>
        )}

        <svg 
          viewBox="0 0 173.049 146.714" 
          className="w-full h-full overflow-visible"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <filter 
              id={filterId}
              colorInterpolationFilters="sRGB" 
              filterUnits="userSpaceOnUse" 
              height="140.537" 
              width="192.137" 
              x="-9.54412" 
              y="18.4489"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feOffset dy="2.72689"/>
              <feGaussianBlur stdDeviation="4.77206"/>
              <feComposite in2="hardAlpha" operator="out"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/>
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
            </filter>
          </defs>
          
          <g>
            {/* Back part - 50% opacity */}
            <path 
              d={FOLDER_BACK_PATH} 
              fill={color} 
              fillOpacity="0.5" 
            />
            
            {/* Front part with shadow */}
            <g filter={`url(#${filterId})`}>
              <rect 
                y="25.2661" 
                width="173.049" 
                height="121.448" 
                rx="15" 
                fill={color} 
              />
            </g>
          </g>
        </svg>
      </div>
      <span className="text-sm text-center font-medium text-[#4E5871] line-clamp-2 px-1 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
        {item.name}
      </span>
      {item.isShared && (
        <span className="text-xs text-purple-500">Od učitele</span>
      )}
    </div>
  );
};

export function StudentContentLayout({ theme, toggleTheme }: StudentContentLayoutProps) {
  const navigate = useNavigate();
  const { student, loading: authLoading, logout } = useStudentAuth();

  // Layout states - matching MyContentLayout
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter state for assignments
  type FilterType = 'all' | 'new' | 'submitted' | 'shared';
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Assignment states
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  
  // Shared folders from teachers
  const [sharedFolders, setSharedFolders] = useState<SharedFolder[]>([]);
  
  // Currently open shared folder
  const [openSharedFolder, setOpenSharedFolder] = useState<{id: string; name: string; color?: string} | null>(null);
  
  // Contents of currently open shared folder
  const [sharedFolderContents, setSharedFolderContents] = useState<TeacherContentItem[]>([]);

  // Content states
  const [myContent, setMyContent] = useState<StudentContentItem[]>([]);
  const [openFolder, setOpenFolder] = useState<StudentContentItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('vivid-student-view-mode');
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });
  const [sortBy, setSortBy] = useState<'date-created' | 'alphabetical' | 'type'>('date-created');

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StudentContentItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<StudentContentItem | null>(null);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('vivid-student-view-mode', viewMode);
  }, [viewMode]);

  // Load data
  useEffect(() => {
    async function loadData() {
      console.log('[StudentContent] loadData called, student:', student?.id, 'class_id:', student?.class_id);
      
      if (!student?.id || !student?.class_id) {
        console.log('[StudentContent] Missing student ID or class_id, skipping load');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Load content
        const content = getStudentContent(student.id);
        setMyContent(content);
        console.log('[StudentContent] Loaded my content:', content.length, 'items');

        // Load assignments and shared folders
        console.log('[StudentContent] Fetching shared folders for class:', student.class_id);
        const [loadedAssignments, loadedSubmissions, loadedSharedFolders] = await Promise.all([
          getAssignmentsForStudent(student.class_id),
          getStudentSubmissions(student.id),
          getSharedFoldersForClass(student.class_id),
        ]);
        console.log('[StudentContent] Loaded assignments:', loadedAssignments.length);
        console.log('[StudentContent] Loaded shared folders:', loadedSharedFolders.length, loadedSharedFolders);
        
        setAssignments(loadedAssignments);
        setSubmissions(loadedSubmissions);
        setSharedFolders(loadedSharedFolders);
      } catch (error) {
        console.error('Error loading content:', error);
        toast.error('Nepodařilo se načíst data');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadData();
    }
  }, [student, authLoading]);

  // Calculate pending and submitted assignments
  const pendingAssignments = assignments.filter(a => {
    const sub = submissions.find(s => s.assignment_id === a.id);
    return !sub || sub.status === 'not_started' || sub.status === 'draft';
  });

  const submittedAssignments = assignments.filter(a => {
    const sub = submissions.find(s => s.assignment_id === a.id);
    return sub && (sub.status === 'submitted' || sub.status === 'graded');
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !student) {
      navigate('/student/login');
    }
  }, [authLoading, student, navigate]);

  // Get folders (top level only for sidebar)
  const myFolders = useMemo(() => {
    return myContent.filter(item => item.type === 'folder' && !item.folder_id);
  }, [myContent]);

  // Get current folder content or root content
  const currentContent = useMemo(() => {
    if (openFolder) {
      return myContent.filter(item => item.folder_id === openFolder.id);
    }
    return myContent.filter(item => !item.folder_id);
  }, [myContent, openFolder]);

  // Sort content
  const sortContent = useCallback((items: StudentContentItem[]) => {
    return [...items].sort((a, b) => {
      // Folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;

      switch (sortBy) {
        case 'date-created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'alphabetical':
          return a.name.localeCompare(b.name, 'cs');
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
  }, [sortBy]);

  // Convert assignments to content items with tags
  const assignmentContentItems = useMemo(() => {
    return assignments.map(assignment => {
      const submission = submissions.find(s => s.assignment_id === assignment.id);
      const isSubmitted = submission?.status === 'submitted' || submission?.status === 'graded';
      const isPending = !submission || submission.status === 'not_started' || submission.status === 'draft';
      
      return {
        id: `assignment_${assignment.id}`,
        name: assignment.title,
        type: 'document' as const,
        content_id: submission?.content_id || `assignment_${assignment.id}`,
        created_at: assignment.created_at,
        assignmentId: assignment.id,
        assignmentTag: isSubmitted ? 'submitted' : 'new',
        isAssignment: true,
      };
    });
  }, [assignments, submissions]);

  // Combine regular content with assignments
  const allContentItems = useMemo(() => {
    // Regular content items (not from assignments)
    const regularItems = currentContent.map(item => ({
      ...item,
      isAssignment: false,
      assignmentTag: undefined as 'new' | 'submitted' | undefined,
      assignmentId: undefined as string | undefined,
    }));
    
    // Only add assignment items if not in a folder
    if (openFolder) {
      return regularItems;
    }
    
    return [...assignmentContentItems, ...regularItems];
  }, [currentContent, assignmentContentItems, openFolder]);

  // Convert shared content to display items
  const sharedContentItems = useMemo(() => {
    console.log('[SharedContent] sharedFolders:', sharedFolders);
    console.log('[SharedContent] openSharedFolder:', openSharedFolder);
    console.log('[SharedContent] sharedFolderContents:', sharedFolderContents);
    
    // If a shared folder is open, show its contents
    if (openSharedFolder) {
      return sharedFolderContents.map(item => ({
        id: item.id,
        student_id: '',
        name: item.name,
        type: item.type,
        content_id: item.id,
        folder_id: item.folder_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        isShared: true,
        isAssignment: false,
        assignmentTag: undefined as 'new' | 'submitted' | undefined,
        assignmentId: undefined as string | undefined,
      }));
    }
    
    // Show list of shared folders
    return sharedFolders.map(folder => ({
      id: folder.id,
      student_id: '',
      name: folder.folder_name,
      type: 'folder' as const,
      content_id: folder.folder_id,
      folder_id: undefined,
      created_at: folder.created_at,
      updated_at: folder.created_at,
      isShared: true,
      isAssignment: false,
      assignmentTag: undefined as 'new' | 'submitted' | undefined,
      assignmentId: undefined as string | undefined,
    }));
  }, [sharedFolders, openSharedFolder, sharedFolderContents]);

  // Filter content based on activeFilter
  const filteredContent = useMemo(() => {
    if (activeFilter === 'shared') {
      // Show shared content from teachers
      return sharedContentItems;
    } else if (activeFilter === 'all') {
      return allContentItems;
    } else if (activeFilter === 'new') {
      return allContentItems.filter(item => item.assignmentTag === 'new');
    } else if (activeFilter === 'submitted') {
      return allContentItems.filter(item => item.assignmentTag === 'submitted');
    }
    return allContentItems;
  }, [allContentItems, sharedContentItems, activeFilter]);

  const sortedContent = useMemo(() => sortContent(filteredContent as StudentContentItem[]), [filteredContent, sortContent]);
  const folders = sortedContent.filter(i => i.type === 'folder');
  const documents = sortedContent.filter(i => i.type === 'document');
  const boards = sortedContent.filter(i => i.type === 'board');

  // Create new document
  const handleCreateDocument = useCallback(() => {
    if (!student) return;

    const docId = `student_doc_${Date.now()}`;
    const docTitle = 'Nový dokument';
    
    // Create the actual document in localStorage first
    const docData = {
      id: docId,
      title: docTitle,
      content: '',
      documentType: 'lesson',
      slug: docId,
      featuredMedia: '',
      sectionImages: [],
      showTOC: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`vivid-doc-${docId}`, JSON.stringify(docData));
    
    // Add reference to student's content
    addStudentContentItem(student.id, {
      name: docTitle,
      type: 'document',
      content_id: docId,
      folder_id: openFolder?.id,
    });

    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);
    
    navigate(`/library/my-content/edit/${docId}?studentMode=true`);
  }, [student, openFolder, navigate]);

  // Create new presentation/board
  const handleCreateBoard = useCallback(() => {
    if (!student) return;

    const boardId = `student_board_${Date.now()}`;
    
    addStudentContentItem(student.id, {
      name: 'Nová prezentace',
      type: 'board',
      content_id: boardId,
      folder_id: openFolder?.id,
    });

    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);
    
    navigate(`/library/quiz-editor/${boardId}?studentMode=true`);
  }, [student, openFolder, navigate]);

  // Create folder
  const handleCreateFolder = useCallback(() => {
    setNewFolderName('');
    setCreateFolderOpen(true);
  }, []);

  const handleConfirmCreateFolder = useCallback(() => {
    if (!student || !newFolderName.trim()) return;

    const randomColor = FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];

    addStudentContentItem(student.id, {
      name: newFolderName.trim(),
      type: 'folder',
      folder_id: openFolder?.id,
    });

    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);

    setNewFolderName('');
    setCreateFolderOpen(false);
    toast.success('Složka vytvořena');
  }, [student, newFolderName, openFolder]);

  // Rename item
  const handleStartRename = useCallback((item: StudentContentItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditFolderOpen(true);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!student || !editingItem || !editItemName.trim()) return;

    updateStudentContentItem(student.id, editingItem.id, { name: editItemName.trim() });
    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);

    setEditItemName('');
    setEditingItem(null);
    setEditFolderOpen(false);
    toast.success('Přejmenováno');
  }, [student, editingItem, editItemName]);

  // Delete item
  const handleStartDelete = useCallback((item: StudentContentItem) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!student || !deletingItem) return;

    deleteStudentContentItem(student.id, deletingItem.id);
    setMyContent(getStudentContent(student.id));
    syncStudentContentToCloud(student.id);

    setDeletingItem(null);
    setDeleteDialogOpen(false);
    toast.success('Smazáno');
  }, [student, deletingItem]);

  // Open content item
  const handleOpenItem = useCallback(async (item: StudentContentItem & { isShared?: boolean; content_id?: string }) => {
    if (item.type === 'folder') {
      if (item.isShared) {
        // Opening a shared folder - load its contents from cloud
        console.log('[SharedFolder] Opening shared folder:', item.name, 'content_id:', item.content_id);
        const folderId = item.content_id || item.id;
        
        // Get folder info for color
        const folderInfo = await getFolderFromCloud(folderId);
        console.log('[SharedFolder] Folder info:', folderInfo);
        
        setOpenSharedFolder({
          id: folderId,
          name: item.name,
          color: folderInfo?.color,
        });
        
        // Load folder contents
        const contents = await getFolderContentsFromCloud(folderId);
        console.log('[SharedFolder] Folder contents:', contents);
        setSharedFolderContents(contents);
        
        // Ensure we're on shared filter
        setActiveFilter('shared');
      } else {
      setOpenFolder(item);
      }
    } else if (item.type === 'document') {
      const contentId = item.content_id || item.id;
      
      if (item.isShared) {
        // For shared documents, load COMPLETE data from cloud
        console.log('[SharedContent] Loading shared document from cloud:', contentId);
        try {
          const response = await fetch(
            `https://njbtqmsxbyvpwigfceke.supabase.co/rest/v1/teacher_content?id=eq.${contentId}&select=*`,
            {
              headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g',
              }
            }
          );
          if (response.ok) {
            const [data] = await response.json();
            console.log('[SharedContent] Document from cloud:', data?.name, data?.content_data);
            if (data?.content_data) {
              // Store the COMPLETE document from cloud (content_data contains the whole doc)
              const docData = {
                ...data.content_data,
                id: contentId,
                title: data.name || data.content_data.title || 'Bez názvu',
              };
              localStorage.setItem(`vivid-doc-${contentId}`, JSON.stringify(docData));
            }
          }
        } catch (error) {
          console.error('[SharedContent] Error loading document:', error);
        }
      } else {
        // For own documents, ensure exists in localStorage
        const existingDoc = localStorage.getItem(`vivid-doc-${contentId}`);
      if (!existingDoc) {
        const docData = {
            id: contentId,
          title: item.name || 'Bez názvu',
          content: '',
          documentType: 'lesson',
            slug: contentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
          localStorage.setItem(`vivid-doc-${contentId}`, JSON.stringify(docData));
        }
      }
      // Shared content opens in VIEW mode, own content opens in EDIT mode
      if (item.isShared) {
        navigate(`/library/my-content/view/${contentId}?studentMode=true`);
      } else {
        navigate(`/library/my-content/edit/${contentId}?studentMode=true`);
      }
    } else if (item.type === 'board') {
      const contentId = item.content_id || item.id;
      
      if (item.isShared) {
        // For shared boards, load COMPLETE data from cloud
        console.log('[SharedContent] Loading shared board from cloud:', contentId);
        try {
          const response = await fetch(
            `https://njbtqmsxbyvpwigfceke.supabase.co/rest/v1/teacher_content?id=eq.${contentId}&select=*`,
            {
              headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g',
              }
            }
          );
          if (response.ok) {
            const [data] = await response.json();
            console.log('[SharedContent] Board from cloud:', data?.name, data?.content_data);
            if (data?.content_data) {
              // Store the COMPLETE board from cloud
              const quizData = {
                ...data.content_data,
                id: contentId,
                title: data.name || data.content_data.title || 'Bez názvu',
              };
              localStorage.setItem(`vividbooks_quiz_${contentId}`, JSON.stringify(quizData));
            }
          }
        } catch (error) {
          console.error('[SharedContent] Error loading board:', error);
        }
        // Create a share session for the board and open in student view
        // This gives the EXACT same UI as when teacher shares with link
        try {
          // Check if share session already exists for this board
          const existingShareId = `shared_${contentId}_${student?.class_id || 'class'}`;
          const existingRef = ref(database!, `quiz_shares/${existingShareId}`);
          const existingSnapshot = await get(existingRef);
          
          if (!existingSnapshot.exists()) {
            // Get the quiz data from localStorage
            const quizRaw = localStorage.getItem(`vividbooks_quiz_${contentId}`);
            const quizData = quizRaw ? JSON.parse(quizRaw) : { id: contentId, title: 'Board', slides: [] };
            
            // Create share session
            const shareData = {
              id: existingShareId,
              quizId: contentId,
              quizData: quizData,
              sessionName: quizData.title || 'Sdílený board',
              shareCode: existingShareId.slice(-6),
              classId: student?.class_id || null, // Store class ID for syncing results
              settings: {
                anonymousAccess: false, // Student is already logged in
                showSolutionHints: true,
                showActivityResults: true,
                requireAnswerToProgress: false,
                showNotes: false,
              },
              createdAt: new Date().toISOString(),
              createdBy: 'teacher',
              responses: {},
            };
            
            await set(existingRef, shareData);
            console.log('[SharedContent] Created share session:', existingShareId);
          }
          
          navigate(`/quiz/student/${existingShareId}`);
        } catch (error) {
          console.error('[SharedContent] Error creating share session:', error);
          // Fallback to practice mode
          navigate(`/quiz/practice/${contentId}`);
        }
      } else {
        // Own boards open in editor
        navigate(`/quiz/edit/${contentId}?studentMode=true`);
      }
    }
  }, [navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-900' : 'bg-[#f4f4f8]'}`}>
      <div className="flex">
      {/* Left Sidebar - Navigation */}
      <aside 
        className={`
          /* Base layout properties */
          top-0 h-screen shrink-0 bg-[#4E5871] flex flex-col 
          transition-all duration-300 ease-in-out
          
          /* Mobile styles (default) */
          fixed left-0 z-30 w-[294px]
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          
          /* Desktop styles (lg breakpoint) */
          lg:sticky lg:translate-x-0 lg:shadow-none
          ${!sidebarVisible 
            ? 'lg:w-0 lg:overflow-hidden lg:border-r-0' 
            : 'lg:w-[312px]'
          }
        `}
      >
        {/* Inner wrapper to maintain width during collapse transition */}
        <div className="w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px]">
        {/* Header with logo */}
        <div className="p-4">
          {toolsOpen ? (
            <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
              <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">
                Naše produkty
              </span>
              <button
                onClick={() => setToolsOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div
                  className="flex items-center min-h-[40px]"
                  onMouseEnter={() => setLogoHovered(true)}
                  onMouseLeave={() => setLogoHovered(false)}
                >
                  <Link to="/student" className="flex items-center">
                    <div className="w-20 h-10 text-white">
                      <VividLogo />
                    </div>
                  </Link>
                </div>
                <ToolsDropdown isOpen={toolsOpen} onToggle={() => setToolsOpen(!toolsOpen)} label="Moje úkoly" variant="yellow" />
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setSidebarVisible(false)}
                  className="hidden lg:block p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                  title="Skrýt menu"
                >
                  <PanelLeftClose className="h-[23px] w-[23px]" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu OR Tools Menu */}
        <div className="flex-1 overflow-hidden text-white flex flex-col">
          {toolsOpen ? (
            <ToolsMenu
              activeItem="my-content"
              isStudentMode={true}
              onItemClick={() => {
                setToolsOpen(false);
                setSidebarOpen(false);
              }}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-2">
                {/* Filter section */}
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 px-2">
                  Filtrovat
                </h3>
                
                <button
                  onClick={() => { setActiveFilter('all'); setOpenFolder(null); setOpenSharedFolder(null); setSharedFolderContents([]); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                    activeFilter === 'all'
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Folder className="w-5 h-5" />
                  <span>Vše</span>
                </button>

                <button
                  onClick={() => { setActiveFilter('new'); setOpenFolder(null); setOpenSharedFolder(null); setSharedFolderContents([]); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                    activeFilter === 'new'
                      ? 'bg-indigo-500/30 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Send className="w-5 h-5" />
                  <span>Nové úkoly</span>
                  {pendingAssignments.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-indigo-500 text-white rounded-full">
                      {pendingAssignments.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveFilter('submitted'); setOpenFolder(null); setOpenSharedFolder(null); setSharedFolderContents([]); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                    activeFilter === 'submitted'
                      ? 'bg-green-500/30 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Odevzdané</span>
                  {submittedAssignments.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-green-500/30 text-green-200 rounded-full">
                      {submittedAssignments.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveFilter('shared'); setOpenFolder(null); setOpenSharedFolder(null); setSharedFolderContents([]); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                    activeFilter === 'shared'
                      ? 'bg-purple-500/30 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Share2 className="w-5 h-5" />
                  <span>Sdíleno se mnou</span>
                  {sharedFolders.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-purple-500/30 text-purple-200 rounded-full">
                      {sharedFolders.length}
                    </span>
                  )}
                </button>

                {/* Folders section */}
                {myFolders.length > 0 && (
                  <>
                    <div className="h-px bg-white/10 my-3" />
                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 px-2">
                      Složky
                    </h3>
                    <div className="space-y-1">
                      {myFolders.map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => { setOpenFolder(folder); setActiveFilter('all'); setOpenSharedFolder(null); setSharedFolderContents([]); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                            openFolder?.id === folder.id 
                              ? 'bg-white/20 text-white' 
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {/* Mini folder SVG */}
                          <div className="w-5 h-4 relative flex-shrink-0">
                            <svg viewBox="0 0 173.049 146.714" className="w-full h-full" fill="none">
                              <path d={FOLDER_BACK_PATH} fill="#bbf7d0" fillOpacity="0.5" />
                              <rect y="25.2661" width="173.049" height="121.448" rx="15" fill="#bbf7d0" />
                            </svg>
                          </div>
                          <span className="truncate">{folder.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 transition-all duration-300">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-30 p-3 rounded-full bg-white shadow-lg border border-slate-200 hover:shadow-xl transition-all"
          style={{ color: '#4E5871' }}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop sidebar toggle - shows when sidebar is hidden */}
        {!sidebarVisible && (
          <button
            onClick={() => setSidebarVisible(true)}
            className="hidden lg:flex fixed top-6 left-6 z-30 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all items-center gap-2"
            title="Otevřít menu"
          >
            <PanelLeft className="h-5 w-5 text-[#4E5871]" />
            <span className="text-sm text-[#4E5871] font-medium">Menu</span>
          </button>
        )}

        {/* Page Content */}
        <div className="max-w-6xl mx-auto px-4 py-8 lg:px-8">
          {/* Unified content view with filter */}
          <>
              {/* Shared Folder View - when a shared folder is open */}
              {openSharedFolder ? (
                <>
                  {/* Shared Folder Header - matching teacher's folder design */}
                  <div className="mb-8 mt-6">
                    <button
                      onClick={() => { setOpenSharedFolder(null); setSharedFolderContents([]); }}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#4E5871] mb-3 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zpět na sdílený obsah
                    </button>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Folder SVG icon matching the cards */}
                        <div className="w-12 h-12 relative">
                          <svg viewBox="0 0 173.049 146.714" className="w-full h-full" fill="none">
                            <path d={FOLDER_BACK_PATH} fill={openSharedFolder.color || '#bbf7d0'} fillOpacity="0.5" />
                            <rect y="25.2661" width="173.049" height="121.448" rx="15" fill={openSharedFolder.color || '#bbf7d0'} />
                          </svg>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#4E5871]">
                          {openSharedFolder.name}
                        </h1>
                      </div>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        Od učitele
                      </span>
                    </div>
                  </div>
                </>
              ) : openFolder ? (
                <>
                  {/* Folder Header - matching teacher's folder design */}
                  <div className="mb-8 mt-6">
                    <button
                      onClick={() => setOpenFolder(null)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#4E5871] mb-3 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zpět na přehled
                    </button>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Folder SVG icon matching the cards */}
                        <div className="w-12 h-12 relative">
                          <svg viewBox="0 0 173.049 146.714" className="w-full h-full" fill="none">
                            <path d={FOLDER_BACK_PATH} fill="#bbf7d0" fillOpacity="0.5" />
                            <rect y="25.2661" width="173.049" height="121.448" rx="15" fill="#bbf7d0" />
                          </svg>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#4E5871]">
                        {openFolder.name}
                      </h1>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="gap-2" onClick={handleCreateFolder}>
                          <FolderPlus className="h-4 w-4" />
                          Nová složka
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                              <Plus className="h-4 w-4" />
                              Přidat obsah
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={handleCreateDocument}>
                              <FileText className="h-4 w-4 mr-2 text-purple-500" />
                              Dokument
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleCreateBoard}>
                              <LayoutGrid className="h-4 w-4 mr-2 text-blue-500" />
                              Board
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Main Overview Header */}
                  <div className="mb-8 mt-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-[#4E5871]">
                      {activeFilter === 'new' ? 'Nové úkoly' : activeFilter === 'submitted' ? 'Odevzdané' : activeFilter === 'shared' ? 'Sdíleno se mnou' : 'Moje soubory'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                      {activeFilter === 'new' 
                        ? 'Úkoly zadané učitelem ke splnění' 
                        : activeFilter === 'submitted' 
                          ? 'Odevzdané práce' 
                          : activeFilter === 'shared'
                            ? 'Materiály sdílené učitelem s vaší třídou'
                          : 'Vlastní dokumenty, prezentace a úkoly'}
                    </p>
                  </div>
                </>
              )}

          {/* My Files Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#4E5871] flex items-center gap-2">
                {activeFilter === 'shared' ? (
                  <>
                    <Share2 className="h-5 w-5" />
                    Sdílený obsah
                  </>
                ) : (
                  <>
                <Folder className="h-5 w-5" />
                Moje soubory
                  </>
                )}
              </h2>
              <div className="flex items-center gap-3">
                {/* Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <ArrowUpDown className="h-4 w-4" />
                      <span className="hidden sm:inline">Řadit</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setSortBy('date-created')} className={sortBy === 'date-created' ? 'bg-slate-100' : ''}>
                      Datum vytvoření
                      {sortBy === 'date-created' && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('type')} className={sortBy === 'type' ? 'bg-slate-100' : ''}>
                      Typu
                      {sortBy === 'type' && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('alphabetical')} className={sortBy === 'alphabetical' ? 'bg-slate-100' : ''}>
                      Abecedně
                      {sortBy === 'alphabetical' && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View mode toggle */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white shadow-sm text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="Zobrazit jako ikony"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'list'
                        ? 'bg-white shadow-sm text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="Zobrazit jako seznam"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                {activeFilter !== 'shared' && (
                <Button variant="outline" className="gap-2 text-[#4E5871]" onClick={handleCreateFolder}>
                  <FolderPlus className="h-4 w-4" />
                  Vytvořit složku
                </Button>
                )}
              </div>
            </div>

            {/* Content Grid/List */}
            {sortedContent.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                {activeFilter === 'shared' || openSharedFolder ? (
                  <>
                    <Share2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-600 mb-2">
                      {openSharedFolder ? 'Tato složka je prázdná' : 'Žádný sdílený obsah'}
                    </h3>
                    <p className="text-slate-400">
                      {openSharedFolder 
                        ? 'Učitel do této složky zatím nic nepřidal'
                        : 'Učitel s vaší třídou zatím nic nesdílel'
                      }
                    </p>
                  </>
                ) : (
                  <>
                <Folder className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  {openFolder ? 'Složka je prázdná' : 'Zatím nemáte žádné soubory'}
                </h3>
                <p className="text-slate-400 mb-6">
                  Vytvořte si první dokument nebo prezentaci
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleCreateDocument}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Nový dokument
                  </button>
                  <button
                    onClick={handleCreateBoard}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Nový Board
                  </button>
                </div>
                  </>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="space-y-6">
                {/* Folders */}
                {folders.length > 0 && (
                  <div className="flex flex-wrap gap-8">
                    {folders.map(item => {
                      const folderWithTag = item as typeof item & { isShared?: boolean };
                      return (
                        <StudentFolderCard
                        key={item.id}
                          item={{ ...item, isShared: folderWithTag.isShared }}
                        onClick={() => handleOpenItem(item)}
                          onMenuClick={folderWithTag.isShared ? undefined : (action) => {
                            if (action === 'rename') handleStartRename(item);
                            if (action === 'delete') handleStartDelete(item);
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Documents and Boards */}
                {(documents.length > 0 || boards.length > 0) && (
                  <div className="flex flex-wrap gap-8">
                    {[...documents, ...boards].map(item => {
                      const itemWithTag = item as typeof item & { assignmentTag?: 'new' | 'submitted'; isAssignment?: boolean; assignmentId?: string; isShared?: boolean };
                      return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (itemWithTag.isAssignment && itemWithTag.assignmentId) {
                            navigate(`/student/assignment/${itemWithTag.assignmentId}`);
                          } else {
                            handleOpenItem(item);
                          }
                        }}
                        className="flex flex-col items-center group cursor-pointer"
                        style={{ width: '126px' }}
                      >
                        <div className={`relative w-full bg-white rounded-lg border-2 shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
                          itemWithTag.assignmentTag === 'new' 
                            ? 'border-indigo-400 group-hover:border-indigo-500' 
                            : itemWithTag.assignmentTag === 'submitted'
                              ? 'border-green-400 group-hover:border-green-500'
                              : item.type === 'document' 
                                ? 'border-slate-200 group-hover:border-purple-400' 
                                : 'border-slate-200 group-hover:border-blue-400'
                        }`} style={{ aspectRatio: '3/4' }}>
                          {/* Type icon - top left */}
                          <div className="absolute top-2 left-2 z-10">
                            <div className={`p-1.5 rounded-lg shadow-sm ${
                              item.type === 'document' ? 'bg-purple-500' : 'bg-blue-500'
                            }`}>
                              {item.type === 'document' ? (
                                <FileText className="h-3 w-3 text-white" />
                              ) : (
                                <LayoutGrid className="h-3 w-3 text-white" />
                              )}
                            </div>
                          </div>
                          {/* Assignment Tag - bottom inside card */}
                          {itemWithTag.assignmentTag && (
                            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-3 z-20">
                              <span className={`px-3 py-1 rounded-full text-[15px] font-bold shadow-md ${
                                itemWithTag.assignmentTag === 'new' 
                                  ? 'bg-indigo-500 text-white' 
                                  : 'bg-green-500 text-white'
                              }`}>
                                {itemWithTag.assignmentTag === 'new' ? 'Nový úkol' : 'Odevzdáno'}
                              </span>
                            </div>
                          )}
                          {!itemWithTag.isAssignment && !itemWithTag.isShared && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-2 right-2 z-10 p-1 rounded-lg bg-white/80 opacity-0 group-hover:opacity-100 hover:bg-white transition-all"
                              >
                                <MoreVertical className="w-4 h-4 text-slate-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartRename(item); }}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Přejmenovat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartDelete(item); }} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Smazat
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                          {/* Shared indicator */}
                          {itemWithTag.isShared && (
                            <div className="absolute top-2 right-2 z-10">
                              <div className="p-1.5 rounded-lg bg-purple-500 shadow-sm">
                                <Share2 className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                              item.type === 'document' ? 'bg-purple-50' : 'bg-blue-50'
                            }`}>
                              {item.type === 'document' ? (
                                <FileText className="w-8 h-8 text-purple-200" />
                              ) : (
                                <LayoutGrid className="w-8 h-8 text-blue-200" />
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-700 text-center truncate w-full px-1">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {itemWithTag.isAssignment ? 'Úkol' : item.type === 'document' ? 'Dokument' : 'Board'}
                        </p>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* List View */
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {sortedContent.map((item, index) => {
                  const itemWithTag = item as typeof item & { assignmentTag?: 'new' | 'submitted'; isAssignment?: boolean; assignmentId?: string; isShared?: boolean };
                  return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (itemWithTag.isAssignment && itemWithTag.assignmentId) {
                        navigate(`/student/assignment/${itemWithTag.assignmentId}`);
                      } else {
                        handleOpenItem(item);
                      }
                    }}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                      index !== sortedContent.length - 1 ? 'border-b border-slate-100' : ''
                    } ${itemWithTag.assignmentTag === 'new' ? 'bg-indigo-50' : itemWithTag.assignmentTag === 'submitted' ? 'bg-green-50' : ''}`}
                  >
                    {/* Folder uses SVG, others use icons */}
                    {item.type === 'folder' ? (
                      <div className="w-10 h-8 relative flex-shrink-0">
                        <svg viewBox="0 0 173.049 146.714" className="w-full h-full" fill="none">
                          <path d={FOLDER_BACK_PATH} fill="#bbf7d0" fillOpacity="0.5" />
                          <rect y="25.2661" width="173.049" height="121.448" rx="15" fill="#bbf7d0" />
                        </svg>
                      </div>
                    ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        item.type === 'document' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {item.type === 'document' && <FileText className="w-5 h-5 text-purple-600" />}
                      {item.type === 'board' && <LayoutGrid className="w-5 h-5 text-blue-600" />}
                    </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-700 truncate">{item.name}</p>
                        {itemWithTag.assignmentTag === 'new' && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-indigo-500 text-white rounded">Nový úkol</span>
                        )}
                        {itemWithTag.assignmentTag === 'submitted' && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-green-500 text-white rounded">Odevzdáno</span>
                        )}
                        {itemWithTag.isShared && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-purple-500 text-white rounded flex items-center gap-1">
                            <Share2 className="w-3 h-3" />
                            Sdíleno
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {itemWithTag.isAssignment ? 'Úkol' : itemWithTag.isShared ? 'Od učitele' : item.type === 'folder' ? 'Složka' : item.type === 'document' ? 'Dokument' : 'Board'}
                      </p>
                    </div>
                    {!itemWithTag.isAssignment && !itemWithTag.isShared && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button onClick={(e) => e.stopPropagation()} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartRename(item); }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Přejmenovat
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartDelete(item); }} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Smazat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </div>
            </>
        </div>
      </main>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vytvořit novou složku</DialogTitle>
            <DialogDescription>Zadejte název pro novou složku</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Název složky"
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>Zrušit</Button>
            <Button onClick={handleConfirmCreateFolder} disabled={!newFolderName.trim()}>Vytvořit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={editFolderOpen} onOpenChange={setEditFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přejmenovat</DialogTitle>
            <DialogDescription>Zadejte nový název</DialogDescription>
          </DialogHeader>
          <Input
            value={editItemName}
            onChange={(e) => setEditItemName(e.target.value)}
            placeholder="Nový název"
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolderOpen(false)}>Zrušit</Button>
            <Button onClick={handleConfirmRename} disabled={!editItemName.trim()}>Přejmenovat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat {deletingItem?.type === 'folder' ? 'složku' : 'soubor'}</DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat "{deletingItem?.name}"? Tato akce je nevratná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Zrušit</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Smazat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StudentContentLayout;
