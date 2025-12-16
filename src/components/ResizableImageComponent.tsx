import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useRef } from 'react';

type WrapStyle = 'inline' | 'float-left' | 'float-right';

// Helper to parse width from style string
const parseWidthFromStyle = (style: string | undefined | null): number => {
  if (!style) return 100;
  const match = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
  return match ? Math.round(parseFloat(match[1])) : 100;
};

// Helper to parse wrap style from style string  
const parseWrapFromStyle = (style: string | undefined | null): WrapStyle => {
  if (!style) return 'inline';
  if (style.includes('float: left')) return 'float-left';
  if (style.includes('float: right')) return 'float-right';
  return 'inline';
};

// Helper to parse alignment from style string
const parseAlignmentFromStyle = (style: string | undefined | null): 'left' | 'center' | 'right' => {
  if (!style) return 'left';
  if (style.includes('margin-left: auto') && style.includes('margin-right: auto')) {
    return 'center';
  } else if (style.includes('margin-left: auto') && !style.includes('margin-right: auto')) {
    return 'right';
  }
  return 'left';
};

export function ResizableImageComponent({ node, updateAttributes, selected, getPos, editor }: NodeViewProps) {
  // Read values directly from node attrs - this is the source of truth
  const nodeStyle = node.attrs.style || '';
  const savedWidth = parseWidthFromStyle(nodeStyle);
  const savedWrap = parseWrapFromStyle(nodeStyle);
  const savedAlign = parseAlignmentFromStyle(nodeStyle);
  
  // Only use local state for drag preview
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Current display width (drag preview or saved)
  const displayWidth = isDragging && dragWidth !== null ? dragWidth : savedWidth;

  // Select this node
  const selectNode = () => {
    if (typeof getPos === 'function') {
      editor.commands.setNodeSelection(getPos());
    }
  };

  // Build style string
  const buildStyleString = (width: number, wrap: WrapStyle, align: 'left' | 'center' | 'right') => {
    let style = `width: ${width}%; height: auto;`;
    
    if (wrap === 'float-left') {
      style += ' float: left; margin-right: 16px; margin-bottom: 8px;';
    } else if (wrap === 'float-right') {
      style += ' float: right; margin-left: 16px; margin-bottom: 8px;';
    } else {
      style += ' display: block;';
      if (align === 'center') {
        style += ' margin-left: auto; margin-right: auto;';
      } else if (align === 'right') {
        style += ' margin-left: auto; margin-right: 0;';
      } else {
        style += ' margin-left: 0; margin-right: auto;';
      }
    }
    
    return style;
  };

  // Update width
  const applyWidth = (percent: number) => {
    const p = Math.max(20, Math.min(100, Math.round(percent)));
    const style = buildStyleString(p, savedWrap, savedAlign);
    updateAttributes({ style });
  };

  // Alignment
  const applyAlignment = (align: 'left' | 'center' | 'right') => {
    const style = buildStyleString(savedWidth, 'inline', align);
    updateAttributes({ style });
  };

  // Wrap style
  const applyWrapStyle = (wrap: WrapStyle) => {
    const style = buildStyleString(savedWidth, wrap, savedAlign);
    updateAttributes({ style });
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    
    // CRITICAL: Read width DIRECTLY from node.attrs.style at the moment of click
    // This ensures we start from the actual saved value, not DOM calculations
    const currentNodeStyle = node.attrs.style || '';
    const startPercent = parseWidthFromStyle(currentNodeStyle);
    const startWrap = parseWrapFromStyle(currentNodeStyle);
    const startAlign = parseAlignmentFromStyle(currentNodeStyle);
    
    // Get parent width for calculating percentage change
    const parentWidth = containerRef.current?.parentElement?.offsetWidth || 800;
    // Calculate starting width in pixels based on the SAVED percentage
    const startPx = (startPercent / 100) * parentWidth;
    
    setIsDragging(true);
    setDragWidth(startPercent);
    
    const startX = e.clientX;
    let newPercent = startPercent;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      let newPx = startPx;
      
      if (side === 'right') {
        newPx = startPx + diff;
      } else {
        newPx = startPx - diff;
      }

      newPercent = Math.round((newPx / parentWidth) * 100);
      newPercent = Math.max(20, Math.min(100, newPercent));
      setDragWidth(newPercent);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Save final width using the CAPTURED wrap and align values
      const style = buildStyleString(newPercent, startWrap, startAlign);
      updateAttributes({ style });
      
      setIsDragging(false);
      setDragWidth(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Wrapper styles based on saved values
  const wrapperStyle: React.CSSProperties = {
    width: `${displayWidth}%`,
  };

  if (savedWrap === 'float-left') {
    wrapperStyle.float = 'left';
    wrapperStyle.marginRight = '16px';
    wrapperStyle.marginBottom = '8px';
  } else if (savedWrap === 'float-right') {
    wrapperStyle.float = 'right';
    wrapperStyle.marginLeft = '16px';
    wrapperStyle.marginBottom = '8px';
  } else {
    wrapperStyle.display = 'block';
    wrapperStyle.marginLeft = savedAlign === 'center' || savedAlign === 'right' ? 'auto' : '0';
    wrapperStyle.marginRight = savedAlign === 'center' ? 'auto' : savedAlign === 'right' ? '0' : 'auto';
  }

  return (
    <NodeViewWrapper 
      className="my-4"
      style={wrapperStyle}
    >
      <div 
        ref={containerRef}
        className={`relative group ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} rounded-lg`}
        onClick={selectNode}
      >
        {/* The image */}
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          className="w-full h-auto rounded-lg block"
          draggable={false}
        />

        {/* Controls - only when selected */}
        {selected && (
          <>
            {/* Left resize handle */}
            <div
              className="absolute top-1/2 w-4 h-12 bg-white border-2 border-blue-500 rounded-full cursor-ew-resize shadow-lg hover:bg-blue-50 active:bg-blue-100 flex items-center justify-center"
              style={{ left: '-8px', transform: 'translateY(-50%)' }}
              onMouseDown={(e) => handleResizeStart(e, 'left')}
            >
              <div className="w-0.5 h-6 bg-blue-400 rounded-full" />
            </div>

            {/* Right resize handle */}
            <div
              className="absolute top-1/2 w-4 h-12 bg-white border-2 border-blue-500 rounded-full cursor-ew-resize shadow-lg hover:bg-blue-50 active:bg-blue-100 flex items-center justify-center"
              style={{ right: '-8px', transform: 'translateY(-50%)' }}
              onMouseDown={(e) => handleResizeStart(e, 'right')}
            >
              <div className="w-0.5 h-6 bg-blue-400 rounded-full" />
            </div>

            {/* Toolbar */}
            <div 
              className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-200 flex items-center gap-1 p-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Wrap style buttons */}
              <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
                {/* Inline (block) */}
                <button
                  type="button"
                  className={`p-1.5 rounded transition-colors ${savedWrap === 'inline' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => applyWrapStyle('inline')}
                  title="Blok (bez obtékání)"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="8" width="18" height="8" rx="1" />
                    <line x1="3" y1="4" x2="21" y2="4" />
                    <line x1="3" y1="20" x2="21" y2="20" />
                  </svg>
                </button>

                {/* Float left */}
                <button
                  type="button"
                  className={`p-1.5 rounded transition-colors ${savedWrap === 'float-left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => applyWrapStyle('float-left')}
                  title="Obtékání zprava"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="6" width="8" height="8" rx="1" />
                    <line x1="14" y1="6" x2="21" y2="6" />
                    <line x1="14" y1="10" x2="21" y2="10" />
                    <line x1="14" y1="14" x2="21" y2="14" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>

                {/* Float right */}
                <button
                  type="button"
                  className={`p-1.5 rounded transition-colors ${savedWrap === 'float-right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => applyWrapStyle('float-right')}
                  title="Obtékání zleva"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="13" y="6" width="8" height="8" rx="1" />
                    <line x1="3" y1="6" x2="10" y2="6" />
                    <line x1="3" y1="10" x2="10" y2="10" />
                    <line x1="3" y1="14" x2="10" y2="14" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Alignment (only for inline) */}
              {savedWrap === 'inline' && (
                <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
                  <button
                    type="button"
                    className={`p-1.5 rounded transition-colors ${savedAlign === 'left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                    onClick={() => applyAlignment('left')}
                    title="Zarovnat vlevo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className={`p-1.5 rounded transition-colors ${savedAlign === 'center' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                    onClick={() => applyAlignment('center')}
                    title="Zarovnat na střed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className={`p-1.5 rounded transition-colors ${savedAlign === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                    onClick={() => applyAlignment('right')}
                    title="Zarovnat vpravo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Size buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${savedWidth <= 30 ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => applyWidth(25)}
                >
                  25%
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${savedWidth > 30 && savedWidth <= 55 ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => applyWidth(50)}
                >
                  50%
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${savedWidth > 55 && savedWidth <= 80 ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => applyWidth(75)}
                >
                  75%
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${savedWidth > 80 ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => applyWidth(100)}
                >
                  100%
                </button>
              </div>
            </div>
          </>
        )}

        {/* Drag indicator while resizing */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
              {displayWidth}%
            </span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
