import { ChevronDown } from 'lucide-react';

interface ToolsDropdownProps {
  isOpen?: boolean;
  onToggle?: () => void;
  label?: string;
  variant?: 'default' | 'yellow' | 'green' | 'light';
}

export const ToolsDropdown = ({ 
  isOpen = false, 
  onToggle, 
  label = 'Knihovna',
  variant = 'default'
}: ToolsDropdownProps) => {
  const getStyles = () => {
    switch (variant) {
      case 'yellow':
        return {
          backgroundColor: '#F5C842',
          color: '#1e1b4b',
          chevronColor: '#1e1b4b'
        };
      case 'green':
        return {
          backgroundColor: '#16A34A',
          color: 'white',
          chevronColor: 'rgba(255,255,255,0.8)'
        };
      case 'light':
        return {
          backgroundColor: '#f1f5f9',
          color: '#334155',
          chevronColor: '#64748b'
        };
      default:
        return {
          backgroundColor: '#4E5871',
          color: 'white',
          chevronColor: 'rgba(255,255,255,0.8)'
        };
    }
  };

  const styles = getStyles();
  
  return (
    <button 
      onClick={onToggle}
      className="flex items-center justify-between gap-2 ml-2 py-4 rounded-xl transition-all duration-200 group outline-none"
      style={{ 
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        boxShadow: '0 4px 12px rgba(78,88,113,0.2)',
        paddingLeft: '12px',
        paddingRight: '42px'
      }}
    >
      <div className="flex flex-col items-start justify-center leading-[1.1]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
        <span className="text-[14px] font-bold tracking-wide">{label}</span>
      </div>
      <ChevronDown 
        className={`w-4 h-4 transition-transform duration-300 group-hover:opacity-80 ${isOpen ? 'rotate-180' : ''}`}
        style={{ color: styles.chevronColor }}
        strokeWidth={2.5} 
      />
    </button>
  );
};
