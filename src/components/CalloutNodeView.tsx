import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Info, AlertTriangle, Lightbulb, AlertCircle, BookOpen, GraduationCap, ChevronDown } from 'lucide-react';

interface CalloutNodeViewProps {
  node: {
    attrs: {
      type: string;
      title?: string;
    };
  };
  updateAttributes: (attrs: Record<string, unknown>) => void;
}

const calloutConfig: Record<string, { 
  icon: React.ElementType; 
  title: string; 
  bgColor: string; 
  iconColor: string;
}> = {
  info: {
    icon: Info,
    title: 'Informace',
    bgColor: '#eff6ff',
    iconColor: '#3b82f6',
  },
  warning: {
    icon: AlertTriangle,
    title: 'Upozornění',
    bgColor: '#fefce8',
    iconColor: '#eab308',
  },
  tip: {
    icon: Lightbulb,
    title: 'Tip',
    bgColor: '#f0fdf4',
    iconColor: '#22c55e',
  },
  danger: {
    icon: AlertCircle,
    title: 'Pozor',
    bgColor: '#fef2f2',
    iconColor: '#ef4444',
  },
  summary: {
    icon: BookOpen,
    title: 'Shrnutí',
    bgColor: '#eef2ff',
    iconColor: '#6366f1',
  },
  methodology: {
    icon: GraduationCap,
    title: 'Metodická inspirace',
    bgColor: '#faf5ff',
    iconColor: '#a855f7',
  },
};

export const CalloutNodeView: React.FC<CalloutNodeViewProps> = ({ node }) => {
  const type = node.attrs.type || 'info';
  const config = calloutConfig[type] || calloutConfig.info;
  const Icon = config.icon;
  const title = node.attrs.title || config.title;

  return (
    <NodeViewWrapper
      className="callout"
      data-type="callout"
      data-callout-type={type}
      style={{
        backgroundColor: config.bgColor,
        borderRadius: '12px',
        padding: '24px',
        margin: '24px 0',
        border: 'none',
      }}
    >
      {/* Header - same as preview */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ flexShrink: 0, color: config.iconColor }}>
          <Icon size={24} />
        </div>
        <h2 
          style={{ 
            flex: 1,
            margin: 0,
            padding: 0,
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#334155',
            border: 'none',
          }}
        >
          {title}
        </h2>
        <div style={{ flexShrink: 0, color: '#94a3b8' }}>
          <ChevronDown size={20} />
        </div>
      </div>
      
      {/* Content */}
      <NodeViewContent 
        className="callout-content" 
        style={{ 
          color: '#475569',
        }} 
      />
    </NodeViewWrapper>
  );
};

export default CalloutNodeView;

