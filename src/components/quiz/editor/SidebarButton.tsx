import React from 'react';
import { Loader2, Plus } from 'lucide-react';

interface SidebarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  label: string;
  variant?: 'default' | 'orange' | 'green';
  disabled?: boolean;
  isLoading?: boolean;
}

export function SidebarButton({
  onClick,
  isActive = false,
  icon: Icon,
  label,
  variant = 'default',
  disabled = false,
  isLoading = false,
}: SidebarButtonProps) {
  let bgColor = isActive ? '#4E5871' : 'white';
  let iconColor = isActive ? 'white' : '#4E5871';
  const labelColor = variant === 'orange' ? '#E8956D' : '#4E5871';

  if (variant === 'orange') {
    bgColor = isLoading ? '#F5A574' : '#E8956D';
    iconColor = 'white';
  } else if (variant === 'green') {
    bgColor = '#4eebc0';
    iconColor = '#4E5871';
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (!disabled && !isLoading) onClick();
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
        {isLoading ? 'Načítám...' : label}
      </span>
    </button>
  );
}

interface AddContentButtonProps {
  onClick: () => void;
  isActive: boolean;
}

export function AddContentButton({ onClick, isActive }: AddContentButtonProps) {
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
