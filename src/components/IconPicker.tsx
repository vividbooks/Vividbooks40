import { useState } from 'react';
import { 
  Link, 
  Database, 
  Github, 
  Zap,
  CreditCard,
  ShoppingBag,
  Mail,
  Users,
  Wand2,
  Copy,
  Monitor,
  FileText,
  Settings,
  Code,
  Inbox,
  Bell,
  Calendar,
  Search,
  Upload,
  Download,
  Heart,
  Star,
  Home,
  Folder,
  File,
  Image,
  Video,
  Music,
  Book,
  Bookmark,
  Tag,
  LucideIcon
} from 'lucide-react';

// Map icon names to components
export const iconMap: Record<string, LucideIcon> = {
  'link': Link,
  'database': Database,
  'github': Github,
  'zap': Zap,
  'credit-card': CreditCard,
  'shopping-bag': ShoppingBag,
  'mail': Mail,
  'users': Users,
  'wand': Wand2,
  'copy': Copy,
  'monitor': Monitor,
  'file-text': FileText,
  'settings': Settings,
  'code': Code,
  'inbox': Inbox,
  'bell': Bell,
  'calendar': Calendar,
  'search': Search,
  'upload': Upload,
  'download': Download,
  'heart': Heart,
  'star': Star,
  'home': Home,
  'folder': Folder,
  'file': File,
  'image': Image,
  'video': Video,
  'music': Music,
  'book': Book,
  'bookmark': Bookmark,
  'tag': Tag,
};

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const IconComponent = value ? iconMap[value] : null;
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded hover:bg-accent transition-colors"
      >
        {IconComponent ? (
          <>
            <IconComponent className="h-4 w-4" />
            <span className="text-sm">Změnit ikonu</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Vybrat ikonu</span>
        )}
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 p-4 bg-popover border border-border rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
            <div className="grid grid-cols-8 gap-2">
              {Object.entries(iconMap).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name);
                    setIsOpen(false);
                  }}
                  className={`
                    p-2 rounded hover:bg-accent transition-colors
                    ${value === name ? 'bg-primary/10 text-primary' : ''}
                  `}
                  title={name}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
            
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="w-full mt-3 px-3 py-2 text-sm border border-border rounded hover:bg-accent transition-colors"
              >
                Odebrat ikonu
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function getIcon(iconName?: string) {
  if (!iconName) return null;
  return iconMap[iconName] || null;
}
