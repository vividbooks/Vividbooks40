import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  FileEdit, 
  Link2, 
  File, 
  Folder,
  Play,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import VividLogo from '../imports/Group70';
import { useViewMode, SharedFolder } from '../contexts/ViewModeContext';

interface SharedFolderViewProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

interface FolderContent {
  id: string;
  type: 'document' | 'worksheet' | 'file' | 'link' | 'folder';
  name: string;
  description?: string;
  url?: string;
  thumbnailUrl?: string;
  linkType?: string;
  mimeType?: string;
  color?: string;
}

export function SharedFolderView({ theme, toggleTheme }: SharedFolderViewProps) {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId: string }>();
  const { isStudent, sharedFolders } = useViewMode();
  
  const [folder, setFolder] = useState<SharedFolder | null>(null);
  const [contents, setContents] = useState<FolderContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStudent) {
      navigate('/docs/fyzika');
      return;
    }
    loadFolderContents();
  }, [folderId, isStudent]);

  const loadFolderContents = () => {
    setLoading(true);
    try {
      const folderInfo = sharedFolders.find(f => f.id === folderId);
      setFolder(folderInfo || null);
      
      const foldersStr = localStorage.getItem('vivid-my-folders');
      if (!foldersStr) {
        setContents([]);
        setLoading(false);
        return;
      }
      
      const folders = JSON.parse(foldersStr);
      const targetFolder = folders.find((f: any) => f.id === folderId);
      
      if (!targetFolder) {
        setContents([]);
        setLoading(false);
        return;
      }
      
      const items: FolderContent[] = [];
      
      if (targetFolder.children) {
        targetFolder.children.forEach((child: any) => {
          if (child.type === 'document') {
            items.push({ id: child.id, type: 'document', name: child.name, description: child.description });
          } else if (child.type === 'folder') {
            items.push({ id: child.id, type: 'folder', name: child.name, color: child.color });
          }
        });
      }
      
      const worksheetsStr = localStorage.getItem('vivid-worksheets');
      if (worksheetsStr) {
        const worksheets = JSON.parse(worksheetsStr);
        worksheets.forEach((ws: any) => {
          if (ws.folderId === folderId) {
            items.push({ id: ws.id, type: 'worksheet', name: ws.title });
          }
        });
      }
      
      const filesStr = localStorage.getItem('vivid-my-files');
      if (filesStr) {
        const files = JSON.parse(filesStr);
        files.forEach((file: any) => {
          if (file.folderId === folderId) {
            items.push({ id: file.id, type: 'file', name: file.fileName, mimeType: file.mimeType });
          }
        });
      }
      
      const linksStr = localStorage.getItem('vivid-my-links');
      if (linksStr) {
        const links = JSON.parse(linksStr);
        links.forEach((link: any) => {
          if (link.folderId === folderId) {
            items.push({ id: link.id, type: 'link', name: link.title, url: link.url, thumbnailUrl: link.thumbnailUrl, linkType: link.linkType });
          }
        });
      }
      
      setContents(items);
    } catch (e) {
      console.error('Failed to load folder contents', e);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const getItemIcon = (item: FolderContent) => {
    switch (item.type) {
      case 'document': return <FileText className="w-5 h-5 text-purple-500" />;
      case 'worksheet': return <FileEdit className="w-5 h-5 text-amber-500" />;
      case 'file': return <File className="w-5 h-5 text-slate-500" />;
      case 'link': return item.linkType === 'youtube' ? <Play className="w-5 h-5 text-red-500" /> : <Link2 className="w-5 h-5 text-blue-500" />;
      case 'folder': return <Folder className="w-5 h-5 text-emerald-500" />;
      default: return <File className="w-5 h-5 text-slate-500" />;
    }
  };

  const getItemBgColor = (item: FolderContent) => {
    switch (item.type) {
      case 'document': return 'bg-purple-100';
      case 'worksheet': return 'bg-amber-100';
      case 'link': return item.linkType === 'youtube' ? 'bg-red-100' : 'bg-blue-100';
      case 'folder': return 'bg-emerald-100';
      default: return 'bg-slate-100';
    }
  };

  const handleItemClick = (item: FolderContent) => {
    if (item.type === 'link' && item.url) {
      window.open(item.url, '_blank');
    } else if (item.type === 'folder') {
      navigate(`/library/student-wall/folder/${item.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/library/student-wall')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Zpět</span>
              </button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
              <VividLogo theme={theme} className="h-8" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: folder?.color || '#bbf7d0' }}>
              <Folder className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{folder?.name || 'Sdílená složka'}</h1>
              <p className="text-slate-500 dark:text-slate-400">{contents.length} položek • Od: {folder?.sharedBy || 'Učitel'}</p>
            </div>
          </div>
        </div>

        {contents.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <Folder className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Složka je prázdná</h3>
            <p className="text-slate-500">Učitel zatím nepřidal žádné materiály.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {contents.map((item) => (
              <button key={`${item.type}-${item.id}`} onClick={() => handleItemClick(item)} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all text-left group flex items-center gap-4">
                {item.type === 'link' && item.thumbnailUrl ? (
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getItemBgColor(item)}`}>
                    {getItemIcon(item)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-800 dark:text-white truncate group-hover:text-emerald-600 transition-colors">{item.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === 'document' ? 'bg-purple-100 text-purple-700' : item.type === 'worksheet' ? 'bg-amber-100 text-amber-700' : item.type === 'link' ? 'bg-blue-100 text-blue-700' : item.type === 'folder' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {item.type === 'document' ? 'Dokument' : item.type === 'worksheet' ? 'Pracovní list' : item.type === 'file' ? 'Soubor' : item.type === 'link' ? 'Odkaz' : 'Složka'}
                  </span>
                </div>
                {item.type === 'link' && <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 shrink-0" />}
                {item.type === 'folder' && <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}






