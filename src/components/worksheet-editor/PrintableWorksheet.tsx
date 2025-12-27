/**
 * PrintableWorksheet - Komponenta optimalizovaná pro PDF export
 * 
 * Vykresluje pracovní list ve formátu A4 s podporou všech typů bloků
 */

import React, { forwardRef } from 'react';
import { 
  Worksheet, 
  WorksheetBlock,
  HeadingContent,
  ParagraphContent,
  InfoboxContent,
  MultipleChoiceContent,
  FillBlankContent,
  FreeAnswerContent,
  ImageContent,
  ImageSize,
  BlockImage,
  TableContent,
  ConnectPairsContent,
  ImageHotspotsContent,
  VideoQuizContent,
} from '../../types/worksheet';

// Size to width mapping for block images (print)
const printImageSizeToWidth: Record<ImageSize, string> = {
  small: '25%',
  medium: '35%',
  large: '50%',
  full: '100%',
};

interface PrintableWorksheetProps {
  worksheet: Worksheet;
}

/**
 * Helper pro získání českého názvu předmětu
 */
function getSubjectLabel(subject: string): string {
  const labels: Record<string, string> = {
    fyzika: 'Fyzika',
    chemie: 'Chemie',
    matematika: 'Matematika',
    prirodopis: 'Přírodopis',
    zemepis: 'Zeměpis',
    dejepis: 'Dějepis',
    cestina: 'Český jazyk',
    anglictina: 'Anglický jazyk',
    other: 'Jiný předmět',
  };
  return labels[subject] || subject || 'Pracovní list';
}

/**
 * Helper pro odstranění HTML tagů
 */
function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export const PrintableWorksheet = forwardRef<HTMLDivElement, PrintableWorksheetProps>(
  ({ worksheet }, ref) => {
    // Guard against null worksheet
    if (!worksheet) {
      return <div ref={ref}>Žádný obsah k zobrazení</div>;
    }
    
    const sortedBlocks = [...(worksheet.blocks || [])].sort((a, b) => a.order - b.order);
    const subject = getSubjectLabel(worksheet.metadata?.subject || 'other');
    const grade = worksheet.metadata?.grade || 6;
    const time = worksheet.metadata?.estimatedTime;
    const columns = worksheet.metadata?.columns || 1;

    // Calculate activity numbers for activity blocks
    const activityTypes = ['multiple-choice', 'fill-blank', 'free-answer'];
    const activityNumbers: Record<string, number> = {};
    let activityCounter = 1;
    sortedBlocks.forEach((block) => {
      if (activityTypes.includes(block.type)) {
        activityNumbers[block.id] = activityCounter;
        activityCounter++;
      }
    });

    return (
      <div 
        ref={ref}
        className="printable-worksheet"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm 20mm',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: '11pt',
          lineHeight: '1.5',
          color: '#1e293b',
          backgroundColor: 'white',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div 
          className="no-break"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '10px',
            marginBottom: '15px',
          }}
        >
          <div style={{ fontSize: '10pt', color: '#64748b' }}>
            {subject} • {grade}. ročník
            {time ? ` • ${time} minut` : ''}
          </div>
          <div style={{ fontSize: '10pt', color: '#64748b' }}>
            Jméno: _________________ Datum: _________
          </div>
        </div>

        {/* Title */}
        <h1 
          className="no-break"
          style={{ 
            fontSize: '22pt', 
            fontWeight: 'bold', 
            marginBottom: '20px',
            marginTop: 0,
            color: '#0f172a'
          }}
        >
          {worksheet.title || 'Pracovní list'}
        </h1>

        {/* Description */}
        {worksheet.description && (
          <p style={{ 
            color: '#64748b', 
            marginBottom: '20px',
            fontSize: '10pt',
          }}>
            {worksheet.description}
          </p>
        )}

        {/* Blocks */}
        <div style={columns === 2 ? {
          columnCount: 2,
          columnGap: '20px',
        } : {}}>
          {sortedBlocks.map((block) => (
            <PrintableBlock key={block.id} block={block} activityNumber={activityNumbers[block.id]} />
          ))}
        </div>

        {/* Footer */}
        <div 
          style={{
            position: 'absolute',
            bottom: '10mm',
            left: '20mm',
            right: '20mm',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9pt',
            color: '#94a3b8',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '5px',
          }}
        >
          <span>Vytvořeno na Vividbooks.cz</span>
        </div>
      </div>
    );
  }
);

PrintableWorksheet.displayName = 'PrintableWorksheet';

// ============================================
// BLOCK COMPONENTS
// ============================================

interface BlockProps {
  block: WorksheetBlock;
  activityNumber?: number;
}

interface BlockWithStyleProps extends BlockProps {
  style: React.CSSProperties;
}

/**
 * Block renderer pro PDF
 */
function PrintableBlock({ block, activityNumber }: BlockProps) {
  const baseStyle: React.CSSProperties = {
    marginBottom: '12px',
    width: block.width === 'half' ? '48%' : '100%',
    display: block.width === 'half' ? 'inline-block' : 'block',
    verticalAlign: 'top',
    breakInside: 'avoid',
  };

  // Render block content
  const renderContent = () => {
    switch (block.type) {
      case 'heading':
        return <PrintableHeading block={block} style={{}} />;
      case 'paragraph':
        return <PrintableParagraph block={block} style={{}} />;
      case 'infobox':
        return <PrintableInfobox block={block} style={{}} />;
      case 'multiple-choice':
        return <PrintableMultipleChoice block={block} style={{}} activityNumber={activityNumber} />;
      case 'fill-blank':
        return <PrintableFillBlank block={block} style={{}} activityNumber={activityNumber} />;
      case 'free-answer':
        return <PrintableFreeAnswer block={block} style={{}} activityNumber={activityNumber} />;
      case 'image':
        return <PrintableImage block={block} style={{}} />;
      case 'table':
        return <PrintableTable block={block} style={{}} />;
      case 'connect-pairs':
        return <PrintableConnectPairs block={block} style={{}} activityNumber={activityNumber} />;
      case 'image-hotspots':
        return <PrintableImageHotspots block={block} style={{}} activityNumber={activityNumber} />;
      case 'video-quiz':
        return <PrintableVideoQuiz block={block} style={{}} activityNumber={activityNumber} />;
      default:
        return null;
    }
  };

  // If block has an image, wrap content with image
  if (block.image?.url) {
    const image = block.image;
    const imageWidth = printImageSizeToWidth[image.size] || '35%';

    if (image.position === 'before') {
      return (
        <div style={baseStyle}>
          <div style={{ maxWidth: imageWidth, marginBottom: '12px' }}>
            <img 
              src={image.url} 
              alt={image.alt || ''} 
              style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
            />
          </div>
          {renderContent()}
        </div>
      );
    }

    // beside-left or beside-right
    const isImageLeft = image.position === 'beside-left';
    return (
      <div style={{ ...baseStyle, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {isImageLeft && (
          <div style={{ width: imageWidth, flexShrink: 0 }}>
            <img 
              src={image.url} 
              alt={image.alt || ''} 
              style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
            />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderContent()}
        </div>
        {!isImageLeft && (
          <div style={{ width: imageWidth, flexShrink: 0 }}>
            <img 
              src={image.url} 
              alt={image.alt || ''} 
              style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
            />
          </div>
        )}
      </div>
    );
  }

  // No image - render with baseStyle directly
  switch (block.type) {
    case 'heading':
      return <PrintableHeading block={block} style={baseStyle} />;
    case 'paragraph':
      return <PrintableParagraph block={block} style={baseStyle} />;
    case 'infobox':
      return <PrintableInfobox block={block} style={baseStyle} />;
    case 'multiple-choice':
      return <PrintableMultipleChoice block={block} style={baseStyle} activityNumber={activityNumber} />;
    case 'fill-blank':
      return <PrintableFillBlank block={block} style={baseStyle} activityNumber={activityNumber} />;
    case 'free-answer':
      return <PrintableFreeAnswer block={block} style={baseStyle} activityNumber={activityNumber} />;
    case 'image':
      return <PrintableImage block={block} style={baseStyle} />;
    case 'table':
      return <PrintableTable block={block} style={baseStyle} />;
    case 'connect-pairs':
      return <PrintableConnectPairs block={block} style={baseStyle} activityNumber={activityNumber} />;
    case 'image-hotspots':
      return <PrintableImageHotspots block={block} style={baseStyle} activityNumber={activityNumber} />;
    case 'video-quiz':
      return <PrintableVideoQuiz block={block} style={baseStyle} activityNumber={activityNumber} />;
    default:
      return null;
  }
}

/**
 * Heading block
 */
function PrintableHeading({ block, style }: BlockWithStyleProps) {
  const content = block.content as HeadingContent;
  const sizes: Record<string, React.CSSProperties> = {
    h1: { fontSize: '18pt', marginTop: '16px', marginBottom: '10px' },
    h2: { fontSize: '14pt', marginTop: '14px', marginBottom: '8px' },
    h3: { fontSize: '12pt', marginTop: '12px', marginBottom: '6px' },
  };
  const levelStyle = sizes[content.level] || sizes.h2;

  return (
    <div 
      style={{ ...style, ...levelStyle, fontWeight: 'bold' }} 
      className="no-break"
    >
      {content.text || ' '}
    </div>
  );
}

/**
 * Paragraph block
 */
function PrintableParagraph({ block, style }: BlockWithStyleProps) {
  const content = block.content as ParagraphContent;
  const text = stripHtml(content.html);

  return (
    <p style={{ ...style, textAlign: 'left', margin: 0 }}>
      {text || ' '}
    </p>
  );
}

/**
 * Infobox block
 */
function PrintableInfobox({ block, style }: BlockWithStyleProps) {
  const content = block.content as InfoboxContent;
  const text = stripHtml(content.html);
  
  const colors: Record<string, { bg: string; border: string }> = {
    blue: { bg: '#eff6ff', border: '#3b82f6' },
    green: { bg: '#f0fdf4', border: '#22c55e' },
    yellow: { bg: '#fefce8', border: '#eab308' },
    purple: { bg: '#faf5ff', border: '#a855f7' },
  };
  const color = colors[content.variant] || colors.blue;

  return (
    <div
      className="no-break"
      style={{
        ...style,
        backgroundColor: color.bg,
        borderLeft: `4px solid ${color.border}`,
        padding: '12px',
        borderRadius: '4px',
      }}
    >
      {content.title && (
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {content.title}
        </div>
      )}
      <div>{text || ' '}</div>
    </div>
  );
}

/**
 * Multiple Choice block
 */
function PrintableMultipleChoice({ block, style, activityNumber }: BlockWithStyleProps) {
  const content = block.content as MultipleChoiceContent;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <div style={style} className="no-break">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
        {activityNumber && (
          <span style={{
            width: '21px',
            height: '21px',
            borderRadius: '50%',
            backgroundColor: '#1e293b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11pt',
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>
            {activityNumber}
          </span>
        )}
        <span style={{ fontWeight: '500' }}>
          {content.question || ' '}
        </span>
      </div>
      <div style={{ paddingLeft: activityNumber ? '34px' : '8px' }}>
        {(content.options || []).map((option, i) => (
          <div 
            key={option.id || i} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '6px' 
            }}
          >
            <span style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '1.5px solid #1e293b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '10px',
              fontSize: '10pt',
              fontWeight: 600,
              color: '#1e293b',
              flexShrink: 0,
            }}>
              {letters[i]}
            </span>
            <span>{option.text || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Fill Blank block
 */
function PrintableFillBlank({ block, style, activityNumber }: BlockWithStyleProps) {
  const content = block.content as FillBlankContent;

  return (
    <div style={style} className="no-break">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {activityNumber && (
          <span style={{
            width: '21px',
            height: '21px',
            borderRadius: '50%',
            backgroundColor: '#1e293b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11pt',
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>
            {activityNumber}
          </span>
        )}
        <div style={{ flex: 1 }}>
          {content.instruction && (
            <div style={{ fontWeight: '500', marginBottom: '8px' }}>
              {content.instruction}
            </div>
          )}
          <div style={{ lineHeight: 2 }}>
            {(content.segments || []).map((segment, i) => (
              segment.type === 'text' ? (
                <span key={i}>{segment.content}</span>
              ) : (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    minWidth: '80px',
                    borderBottom: '1.5px solid #94a3b8',
                    marginLeft: '4px',
                    marginRight: '4px',
                  }}
                >
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </span>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Free Answer block
 */
function PrintableFreeAnswer({ block, style, activityNumber }: BlockWithStyleProps) {
  const content = block.content as FreeAnswerContent;
  const lines = content.lines || 3;

  return (
    <div style={style} className="no-break">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
        {activityNumber && (
          <span style={{
            width: '21px',
            height: '21px',
            borderRadius: '50%',
            backgroundColor: '#1e293b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11pt',
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>
            {activityNumber}
          </span>
        )}
        <span style={{ fontWeight: '500' }}>
          {content.question || ' '}
        </span>
      </div>
      {content.hint && (
        <div style={{ 
          fontSize: '10pt', 
          color: '#64748b', 
          fontStyle: 'italic', 
          marginBottom: '8px',
          paddingLeft: activityNumber ? '34px' : 0,
        }}>
          Nápověda: {content.hint}
        </div>
      )}
      <div style={{ paddingLeft: activityNumber ? '34px' : 0 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '24px',
              borderBottom: '1px dotted #cbd5e1',
              marginBottom: '2px',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Image block
 */
function PrintableImage({ block, style }: BlockWithStyleProps) {
  const content = block.content as ImageContent;
  const { url, alt, caption, showCaption = true, size = 'medium', alignment = 'center' } = content;

  if (!url) return null;

  // Size to max-width mapping
  const sizeToWidth: Record<ImageSize, string> = {
    small: '30%',
    medium: '50%',
    large: '75%',
    full: '100%',
  };

  // Alignment to justify mapping
  const alignmentToJustify: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  return (
    <div 
      style={{ 
        ...style, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: alignmentToJustify[alignment] || 'center',
      }} 
      className="no-break"
    >
      <div style={{ maxWidth: sizeToWidth[size], width: '100%' }}>
        <img
          src={url}
          alt={alt || ''}
          style={{ 
            width: '100%', 
            height: 'auto', 
            display: 'block',
            borderRadius: '4px',
          }}
        />
        {caption && showCaption && (
          <p style={{ 
            textAlign: 'center', 
            color: '#64748b', 
            fontSize: '10pt', 
            marginTop: '8px',
            fontStyle: 'italic',
          }}>
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Table block
 */
function PrintableTable({ block, style }: BlockWithStyleProps) {
  const content = block.content as TableContent;
  const { html, hasBorder, hasRoundedCorners } = content;

  if (!html) return null;

  const tableClasses = [
    'tiptap-editor',
    !hasBorder ? 'no-border' : '',
    !hasRoundedCorners ? 'no-rounded' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      style={style}
      className={tableClasses}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Connect Pairs block (Spojovačka)
 */
function PrintableConnectPairs({ block, style, activityNumber }: BlockWithStyleProps) {
  const content = block.content as ConnectPairsContent;

  return (
    <div style={style} className="no-break">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
        {activityNumber && (
          <span style={{
            width: '21px',
            height: '21px',
            borderRadius: '50%',
            backgroundColor: '#1e293b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11pt',
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>
            {activityNumber}
          </span>
        )}
        <span style={{ fontWeight: '500' }}>
          {content.instruction || 'Spoj správné dvojice'}
        </span>
      </div>

      {/* Two columns for pairs */}
      <div style={{ 
        display: 'flex', 
        gap: '40px',
        paddingLeft: activityNumber ? '34px' : 0,
      }}>
        {/* Left column */}
        <div style={{ flex: 1 }}>
          {content.pairs.map((pair, idx) => (
            <div 
              key={`left-${pair.id}`}
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            >
              <span style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '1.5px solid #3b82f6',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9pt',
                fontWeight: 600,
                color: '#3b82f6',
                flexShrink: 0,
              }}>
                {idx + 1}
              </span>
              <span>{pair.left.content || '...'}</span>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{ flex: 1 }}>
          {content.pairs.map((pair, idx) => (
            <div 
              key={`right-${pair.id}`}
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            >
              <span style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '1.5px solid #a855f7',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9pt',
                fontWeight: 600,
                color: '#a855f7',
                flexShrink: 0,
              }}>
                {String.fromCharCode(65 + idx)}
              </span>
              <span>{pair.right.content || '...'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Image Hotspots block (Poznávačka)
 */
function PrintableImageHotspots({ block, style, activityNumber }: BlockWithStyleProps) {
  const content = block.content as ImageHotspotsContent;

  return (
    <div style={style} className="no-break">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
        {activityNumber && (
          <span style={{
            width: '21px',
            height: '21px',
            borderRadius: '50%',
            backgroundColor: '#1e293b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11pt',
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>
            {activityNumber}
          </span>
        )}
        <span style={{ fontWeight: '500' }}>
          {content.instruction || 'Označ správná místa na obrázku'}
        </span>
      </div>

      <div style={{ paddingLeft: activityNumber ? '34px' : 0 }}>
        {/* Image with numbered hotspots */}
        {content.imageUrl && (
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <img 
              src={content.imageUrl} 
              alt="Poznávačka"
              style={{ 
                maxWidth: '100%',
                maxHeight: '200px',
                display: 'block',
                borderRadius: '6px',
              }}
            />
          </div>
        )}

        {/* Answer lines for each hotspot */}
        {content.hotspots.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            {content.hotspots.map((hotspot, idx) => (
              <div 
                key={hotspot.id}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '8px',
                }}
              >
                <span style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#a855f7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10pt',
                  fontWeight: 600,
                  color: 'white',
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <div style={{ 
                  flex: 1,
                  borderBottom: '1.5px dotted #94a3b8',
                  minHeight: '24px',
                }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Video Quiz block
 */
function PrintableVideoQuiz({ block, style, activityNumber }: BlockWithStyleProps) {
  const content = block.content as VideoQuizContent;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div style={style} className="no-break">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
        {activityNumber && (
          <span style={{
            width: '21px',
            height: '21px',
            borderRadius: '50%',
            backgroundColor: '#1e293b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11pt',
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>
            {activityNumber}
          </span>
        )}
        <span style={{ fontWeight: '500' }}>
          {content.instruction || 'Video kvíz'}
        </span>
      </div>

      <div style={{ paddingLeft: activityNumber ? '34px' : 0 }}>
        {/* Video URL info */}
        {content.videoUrl && (
          <div style={{ 
            padding: '8px 12px',
            backgroundColor: '#f1f5f9',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '10pt',
            color: '#64748b',
          }}>
            Video: {content.videoUrl}
          </div>
        )}

        {/* Questions */}
        {content.questions.map((q, qIdx) => (
          <div key={q.id} style={{ marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: '8px',
              fontWeight: '500',
            }}>
              <span style={{
                fontSize: '9pt',
                color: '#64748b',
                backgroundColor: '#e2e8f0',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}>
                {formatTime(q.timestamp)}
              </span>
              <span>{q.question}</span>
            </div>
            
            {/* Options */}
            <div style={{ paddingLeft: '8px' }}>
              {q.options.map((opt, optIdx) => (
                <div 
                  key={opt.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '4px',
                  }}
                >
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: '1.5px solid #1e293b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '8px',
                    fontSize: '9pt',
                    fontWeight: 600,
                    color: '#1e293b',
                    flexShrink: 0,
                  }}>
                    {letters[optIdx]}
                  </span>
                  <span style={{ fontSize: '10pt' }}>{opt.content}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {content.questions.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: '10pt', fontStyle: 'italic' }}>
            Žádné otázky k videu
          </p>
        )}
      </div>
    </div>
  );
}

