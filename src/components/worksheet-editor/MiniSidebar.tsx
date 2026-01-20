/**
 * MiniSidebar - Levý postranní panel editoru pracovních listů
 */

import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Plus, 
  Sparkles,
  SlidersHorizontal, 
  Loader2,
  ArrowLeft,
  History
} from 'lucide-react';

export type ActivePanel = 'structure' | 'add' | 'ai' | 'settings' | 'history';
type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface MiniSidebarProps {
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
  saveStatus: SaveStatus;
  hideAI?: boolean; // Hide AI button (for student mode when AI not allowed)
  onOpenHistory?: () => void; // Open version history modal
  hasUnsavedVersions?: boolean; // Show indicator for unsaved versions
}

// Reusable button component
function SidebarButton({ 
  onClick, 
  isActive = false, 
  icon: Icon, 
  label,
  variant = 'default',
  disabled = false,
  isLoading = false,
}: { 
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  variant?: 'default' | 'orange';
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const bgColor = variant === 'orange' 
    ? (isLoading ? '#F5A574' : '#E8956D')
    : (isActive ? '#4E5871' : 'white');
  
  const iconColor = variant === 'orange' 
    ? 'white' 
    : (isActive ? 'white' : '#4E5871');

  const labelColor = variant === 'orange' ? '#E8956D' : '#4E5871';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (!disabled && !isLoading) {
          onClick();
        }
      }}
      disabled={disabled || isLoading}
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        marginBottom: '8px',
      }}
    >
      <div 
        style={{ 
          width: '70px', 
          height: '70px',
          backgroundColor: bgColor,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        {isLoading ? (
          <Loader2 size={28} className="animate-spin" style={{ color: iconColor }} strokeWidth={1.5} />
        ) : (
          <Icon size={28} strokeWidth={1.5} style={{ color: iconColor }} />
        )}
      </div>
      <span 
        style={{ 
          fontSize: '12px',
          fontWeight: 500,
          marginTop: '8px',
          color: labelColor,
          textAlign: 'center',
        }}
      >
        {isLoading ? 'Exportuji...' : label}
      </span>
    </button>
  );
}

// Plus button with inner circle
function AddContentButton({ 
  onClick, 
  isActive,
}: { 
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        marginBottom: '8px',
      }}
    >
      <div 
        style={{ 
          width: '70px', 
          height: '70px',
          backgroundColor: isActive ? '#4E5871' : 'white',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#4E5871',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={22} strokeWidth={2} style={{ color: 'white' }} />
        </div>
      </div>
      <span 
        style={{ 
          fontSize: '12px',
          fontWeight: 500,
          marginTop: '8px',
          color: '#4E5871',
          textAlign: 'center',
        }}
      >
        Přidat obsah
      </span>
    </button>
  );
}

export function MiniSidebar({ 
  activePanel, 
  onPanelChange, 
  saveStatus,
  hideAI = false,
  onOpenHistory,
  hasUnsavedVersions = false,
}: MiniSidebarProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (saveStatus !== 'saving') {
      navigate('/library/my-content');
    }
  };

  return (
    <div 
      data-sidebar
      data-print-hide="true"
      className="left-toolbar print:!hidden"
      style={{ 
        width: '100px',
        minWidth: '100px',
        height: '100%',
        backgroundColor: '#E8ECF4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '16px',
        paddingBottom: '16px',
      }}
    >
      {/* Zpět button */}
      <button
        type="button"
        onClick={handleBack}
        disabled={saveStatus === 'saving'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '16px',
          background: 'none',
          border: 'none',
          cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
          padding: 0,
        }}
      >
        {saveStatus === 'saving' ? (
          <>
            <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} strokeWidth={2} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#3b82f6' }}>Ukládám...</span>
          </>
        ) : (
          <>
            <ArrowLeft size={16} strokeWidth={2} style={{ color: '#4E5871' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#4E5871' }}>Zpět</span>
          </>
        )}
      </button>
      
      {/* Můj list */}
      <SidebarButton
        onClick={() => onPanelChange('structure')}
        isActive={activePanel === 'structure'}
        icon={BookOpen}
        label="Můj list"
      />
      
      {/* Přidat obsah */}
      <AddContentButton
        onClick={() => onPanelChange('add')}
        isActive={activePanel === 'add'}
      />
      
      {/* AI - hidden when hideAI is true (student mode with AI not allowed) */}
      {!hideAI && (
        <SidebarButton
          onClick={() => onPanelChange('ai')}
          isActive={activePanel === 'ai'}
          icon={Sparkles}
          label="AI"
        />
      )}
      
      {/* Separator */}
      <div style={{ width: '48px', height: '1px', backgroundColor: '#C5CCD9', margin: '12px 0' }} />
      
      {/* Nastavení */}
      <SidebarButton
        onClick={() => onPanelChange('settings')}
        isActive={activePanel === 'settings'}
        icon={SlidersHorizontal}
        label="Nastavení"
      />
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
    </div>
  );
}
