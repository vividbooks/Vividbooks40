/**
 * ProMiniSidebar - Figma-style dark sidebar for PRO editor
 * 
 * Narrow icon-only sidebar with tooltips, dark mode inspired by Figma.
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Sparkles,
  SlidersHorizontal, 
  Loader2,
  History,
  LayoutGrid,
  ImageUp,
  Printer,
  Download,
  Scissors,
  MonitorPlay,
  Image,
  Settings,
  Database,
  Palette,
  ChevronLeft,
  MessageSquare,
  Workflow,
} from 'lucide-react';

// Custom workbook/structure icon (Vividbooks brand icon)
function WorkbookIcon({ size = 24, className, style }: { size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 25 22"
      width={size}
      height={size}
      className={className}
      style={style}
      fill="currentColor"
    >
      <path d="M23.2,8.9l-4.1-7h0c-.5-.6-1.2-1-2.1-1s-.5,0-.6,0h0c-2.3.2-4.7,1.5-6.1,3.3,0,0,0,.2-.2.3-.3,0-.6-.2-.8-.2h-1.8c-1.8,0-3.6.9-5,2.1h0c-.2.2-.6.4-.7.6-.6.6-.6,1.3-.6,1.7v.2h0l.2.6h0c-.2.2-.4.6-.3.7h0l4.9,10.1c.2.4.5.6.9.5.3,0,1-.9,1.4-1.1,1.7-1.5,4-2.1,6.3-2h1.2c.4,0,.6-.5.9-.6,1.2-1.1,2.9-1.6,4.5-1.7.4,0,1.4,0,1.2-.6,0-.3-.9-1.4-.8-1.5.3,0,1.5,0,1.7-.2h0v-.6c0-.3-.4-.7-.6-1.1.3-.2.4-.2.6-.7s0-1.7,0-1.7h-.1ZM2.9,7.2c1.2-1.1,2.8-1.7,4.4-1.8h1.6c.3,0,.7,0,.9.4l4.6,9h0c0,.3,0,.4-.3.4s0,0,0,0c-.6,0-1.2-.2-1.8-.3h-.6c-1.5,0-2.9.3-4.1.9s-.8.6-1.2.6-.4,0-.5-.3l-3.7-7.7c0-.3,0-.5.3-.7.2-.2.3-.4.5-.5h0ZM20.7,10.7c-1.5.5-2.9,1.6-4,2.7-.3.4-.4.7-.6,1h-.2s0,0,0,0h0c-.3-.5-5-9.3-4.8-9.5,1.2-1.6,3.2-2.7,5.2-2.8h.6c.5,0,.9,0,1.2.5l4.1,7v.5c0,.6-1,.6-1.5.7h0Z"/>
    </svg>
  );
}

export type ProActivePanel = 'sheet-settings' | 'structure' | 'add' | 'ai' | 'import' | 'settings' | 'history' | 'export';
type SaveStatus = 'saved' | 'saving' | 'unsaved';

export type AppMode = 'chapter' | 'book' | 'dataset';
export type BookViewMode =
  | 'canvas'
  | 'covers'
  | 'settings'
  | 'design'
  | 'design2'
  | 'agentPipeline'
  | 'collaboration';

interface ProMiniSidebarProps {
  activePanel: ProActivePanel;
  onPanelChange: (panel: ProActivePanel) => void;
  saveStatus: SaveStatus;
  hideAI?: boolean;
  hasUnsavedVersions?: boolean;
  workbookId?: string | null;
  onPrint?: (opts?: { bleed?: boolean }) => void;
  appMode?: AppMode;
  onLogoClick?: () => void;
  /** Režim kapitoly v knize: logo = šipka zpět do celé knihy (místo přepínače módů) */
  logoBackToBook?: boolean;
  /** book mode only */
  bookViewMode?: BookViewMode;
  onBookViewChange?: (mode: BookViewMode) => void;
}

// Figma-style icon button with fixed-position tooltip (avoids overflow clipping)
function IconButton({ 
  onClick, 
  isActive = false, 
  icon: Icon, 
  label,
  disabled = false,
  isLoading = false,
  hasNotification = false,
}: { 
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  disabled?: boolean;
  isLoading?: boolean;
  hasNotification?: boolean;
}) {
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
  };

  return (
    <div 
      ref={btnRef}
      style={{ position: 'relative' }}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltipPos(null)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if (!disabled && !isLoading) onClick();
        }}
        disabled={disabled || isLoading}
        style={{ 
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: isActive ? '#5C5CFF' : tooltipPos ? '#334155' : 'transparent',
          border: 'none',
          borderRadius: '6px',
          padding: 0,
          transition: 'all 0.1s ease',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {isLoading ? (
          <Loader2 size={18} strokeWidth={1.8} className="animate-spin" style={{ color: '#94a3b8' }} />
        ) : (
          <Icon size={18} strokeWidth={1.8} style={{ color: isActive ? 'white' : '#94a3b8' }} />
        )}
      </button>
      
      {/* Notification dot */}
      {hasNotification && (
        <div 
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '8px',
            height: '8px',
            backgroundColor: '#FF4444',
            borderRadius: '50%',
            border: '2px solid #1e293b',
          }}
        />
      )}
      
      {/* Tooltip — fixed position to escape overflow clipping */}
      {tooltipPos && (
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: 'translateY(-50%)',
            backgroundColor: '#0f172a',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

function PrintPopover({ onPrint }: { onPrint: (opts?: { bleed?: boolean }) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        popRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const top = Math.min(r.top, window.innerHeight - 160);
      setPos({ top, left: r.right + 8 });
    }
    setOpen(!open);
  };

  return (
    <>
      <div ref={btnRef}>
        <IconButton onClick={toggle} isActive={open} icon={Printer} label="Export PDF" />
      </div>
      {open && (
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: 230,
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 10,
            padding: 6,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onPrint(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              background: 'transparent', border: 'none', color: '#e2e8f0',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#334155'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Download size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
            <div>
              <div>Standardní PDF</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>210 × 297 mm (A4)</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onPrint({ bleed: true }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              background: 'transparent', border: 'none', color: '#e2e8f0',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#334155'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Scissors size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <div>Tiskové PDF</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>216 × 303 mm (+3 mm spadávky, ořezové značky)</div>
            </div>
          </button>
        </div>
      )}
    </>
  );
}

function LaioutSymbol() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  return (
    <div style={{ width: '32px', height: '32px', marginBottom: '4px', position: 'relative' }}>
      <style>{`
        @keyframes laiout-from-left {
          from { opacity: 0; clip-path: inset(0 100% 0 0); }
          to   { opacity: 1; clip-path: inset(0 0% 0 0); }
        }
        @keyframes laiout-from-right {
          from { opacity: 0; clip-path: inset(0 0 0 100%); }
          to   { opacity: 1; clip-path: inset(0 0 0 0%); }
        }
        .laiout-bar3  { animation: laiout-from-left  550ms cubic-bezier(0.34,1.52,0.64,1)   0ms both; }
        .laiout-bar2  { animation: laiout-from-left  550ms cubic-bezier(0.34,1.52,0.64,1)  90ms both; }
        .laiout-bar1  { animation: laiout-from-left  550ms cubic-bezier(0.34,1.52,0.64,1) 180ms both; }
        .laiout-short { animation: laiout-from-left  550ms cubic-bezier(0.34,1.52,0.64,1) 270ms both; }
        .laiout-tall  { animation: laiout-from-left  550ms cubic-bezier(0.34,1.52,0.64,1) 360ms both; }
        .laiout-circ  { animation: laiout-from-right 600ms cubic-bezier(0.34,1.52,0.64,1) 100ms both; }
      `}</style>
      <svg viewBox="0 0 572 603" width="32" height="32" fill="none" style={{ overflow: 'visible' }}>
        {mounted && <>
          <rect className="laiout-tall"  x="0"     y="0"       width="244" height="284" fill="white"/>
          <rect className="laiout-short" x="0"     y="337"     width="143" height="37"  fill="white"/>
          <rect className="laiout-bar1"  x="0"     y="406.835" width="244" height="38"  fill="white"/>
          <rect className="laiout-bar2"  x="0"     y="477.835" width="244" height="38"  fill="white"/>
          <rect className="laiout-bar3"  x="0"     y="548.835" width="244" height="37"  fill="white"/>
          <circle className="laiout-circ" cx="430" cy="461"    r="142"                  fill="white"/>
        </>}
      </svg>
    </div>
  );
}

export function ProMiniSidebar({ 
  activePanel, 
  onPanelChange, 
  saveStatus,
  hideAI = false,
  hasUnsavedVersions = false,
  workbookId,
  onPrint,
  appMode = 'chapter',
  onLogoClick,
  logoBackToBook = false,
  bookViewMode = 'canvas',
  onBookViewChange,
}: ProMiniSidebarProps) {
  const [logoHovered, setLogoHovered] = useState(false);

  return (
    <aside 
      style={{ 
        width: '48px', 
        backgroundColor: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '8px',
        paddingBottom: '8px',
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        gap: '4px',
      }}
    >
      {/* Logo vždy Laiout; v knize při hoveru „Zpět“ nebo „Ukládám“ */}
      <div
        style={{ position: 'relative', marginBottom: '4px' }}
        onMouseEnter={() => setLogoHovered(true)}
        onMouseLeave={() => setLogoHovered(false)}
      >
        <button
          type="button"
          onClick={onLogoClick}
          disabled={!onLogoClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: onLogoClick ? 'pointer' : 'default',
            padding: 0,
            margin: 0,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            width: '32px',
            height: '32px',
            opacity: onLogoClick ? 1 : 0.5,
          }}
          title={logoBackToBook ? 'Zpět do knihy' : 'Přepnout mód'}
        >
          <span
            style={{
              display: 'flex',
              opacity: logoBackToBook && logoHovered ? 0.12 : 1,
              transition: 'opacity 0.12s ease',
            }}
          >
            <LaioutSymbol />
          </span>
          {logoBackToBook && logoHovered && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                pointerEvents: 'none',
                borderRadius: 8,
                background:
                  saveStatus === 'saving'
                    ? 'rgba(120, 53, 15, 0.92)'
                    : 'rgba(15, 23, 42, 0.92)',
                border:
                  saveStatus === 'saving'
                    ? '1px solid rgba(251, 191, 36, 0.45)'
                    : '1px solid rgba(51, 65, 85, 0.8)',
              }}
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 size={13} className="animate-spin" style={{ color: '#fbbf24' }} />
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: '#fef3c7',
                      lineHeight: 1.05,
                      textAlign: 'center',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Ukládám
                  </span>
                </>
              ) : (
                <ChevronLeft
                  size={20}
                  strokeWidth={2.5}
                  style={{ color: '#f8fafc' }}
                  aria-hidden
                />
              )}
            </div>
          )}
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: '24px', height: '1px', backgroundColor: '#334155', margin: '4px 0' }} />

      {appMode === 'chapter' && <>
        {/* Sheet Settings */}
        <IconButton
          onClick={() => onPanelChange('sheet-settings')}
          isActive={activePanel === 'sheet-settings'}
          icon={LayoutGrid}
          label="Nastavení listu"
        />

        {/* Structure */}
        <IconButton
          onClick={() => onPanelChange('structure')}
          isActive={activePanel === 'structure'}
          icon={WorkbookIcon}
          label="Můj list"
        />

        {/* Add Content */}
        <IconButton
          onClick={() => onPanelChange('add')}
          isActive={activePanel === 'add'}
          icon={Plus}
          label="Přidat obsah"
        />

        {/* AI */}
        {!hideAI && (
          <IconButton
            onClick={() => onPanelChange('ai')}
            isActive={activePanel === 'ai'}
            icon={Sparkles}
            label="AI asistent"
          />
        )}

        {/* Import Agent */}
        <IconButton
          onClick={() => onPanelChange('import')}
          isActive={activePanel === 'import'}
          icon={ImageUp}
          label="Import ze screenshotu"
        />

        {/* Settings */}
        <IconButton
          onClick={() => onPanelChange('settings')}
          isActive={activePanel === 'settings'}
          icon={SlidersHorizontal}
          label="Nastavení"
        />

        {/* Export do Vividboardu */}
        <IconButton
          onClick={() => onPanelChange('export')}
          isActive={activePanel === 'export'}
          icon={MonitorPlay}
          label="Export do Vividboardu"
        />

        {/* PDF Export with popover */}
        {onPrint && <PrintPopover onPrint={onPrint} />}
      </>}

      {appMode === 'book' && <>
        {/* Obálka je v širokém panelu u kapitol; data set v Nastavení → záložka */}
        <IconButton
          onClick={() => onBookViewChange?.('canvas')}
          isActive={bookViewMode === 'canvas'}
          icon={LayoutGrid}
          label="Obsah"
        />
        <IconButton
          onClick={() => onBookViewChange?.('settings')}
          isActive={bookViewMode === 'settings'}
          icon={Settings}
          label="Nastavení"
        />
        <IconButton
          onClick={() => onBookViewChange?.('design')}
          isActive={bookViewMode === 'design'}
          icon={Palette}
          label="Design systém"
        />
        <IconButton
          onClick={() => onBookViewChange?.('design2')}
          isActive={bookViewMode === 'design2'}
          icon={Sparkles}
          label="Design systém 2"
        />
        <IconButton
          onClick={() => onBookViewChange?.('agentPipeline')}
          isActive={bookViewMode === 'agentPipeline'}
          icon={Workflow}
          label="Agenti"
        />
        <IconButton
          onClick={() => onBookViewChange?.('collaboration')}
          isActive={bookViewMode === 'collaboration'}
          icon={MessageSquare}
          label="Komentáře"
        />
      </>}

      {appMode === 'dataset' && <>
        <IconButton
          onClick={() => {}}
          isActive={true}
          icon={Database}
          label="Soubory"
        />
      </>}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Historie verzí (levý panel jako ve Figmě) */}
      {appMode === 'chapter' && (
        <IconButton
          onClick={() => onPanelChange('history')}
          isActive={activePanel === 'history'}
          icon={History}
          label="Historie verzí"
          hasNotification={hasUnsavedVersions}
        />
      )}

      {/* Save Status Indicator */}
      <div 
        style={{ 
          marginTop: '4px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: saveStatus === 'saved' ? '#4ADE80' : saveStatus === 'saving' ? '#FBBF24' : '#EF4444',
          boxShadow: `0 0 6px ${saveStatus === 'saved' ? '#4ADE80' : saveStatus === 'saving' ? '#FBBF24' : '#EF4444'}`,
        }}
        title={saveStatus === 'saved' ? 'Uloženo' : saveStatus === 'saving' ? 'Ukládám...' : 'Neuloženo'}
      />
    </aside>
  );
}
