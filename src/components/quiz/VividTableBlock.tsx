/**
 * VividTableBlock
 *
 * Identical table editor to the one in the worksheet Pro editor.
 * Uses TipTap with the same extensions + the same CSS classes
 * (.worksheet-table-container, .tiptap-editor, .table-dropdown …)
 * that are already defined in index.css.
 *
 * Props:
 *   data      — { html, hasBorder?, hasRoundedCorners?, colorStyle? }
 *   onChange  — called with updated data (no-op when editable=false)
 *   editable  — false renders a read-only view (QuizPreview / playback)
 */

import React, { useRef, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { ChevronDown, Plus } from 'lucide-react';

export interface VividTableData {
  html: string;
  hasBorder?: boolean;
  hasRoundedCorners?: boolean;
  colorStyle?: string;
}

interface VividTableBlockProps {
  data: VividTableData;
  onChange: (data: VividTableData) => void;
  editable?: boolean;
}

const COLOR_MAP: Record<string, { header: string; border: string }> = {
  blue:   { header: '#dbeafe', border: '#3b82f6' },
  green:  { header: '#dcfce7', border: '#22c55e' },
  purple: { header: '#f3e8ff', border: '#a855f7' },
  yellow: { header: '#fef3c7', border: '#f59e0b' },
  red:    { header: '#fee2e2', border: '#ef4444' },
  pink:   { header: '#fce7f3', border: '#ec4899' },
  cyan:   { header: '#cffafe', border: '#06b6d4' },
};

export function VividTableBlock({ data, onChange, editable = true }: VividTableBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasBorder, setHasBorder] = useState(data.hasBorder ?? true);
  const [hasRoundedCorners, setHasRoundedCorners] = useState(data.hasRoundedCorners ?? true);
  const [colorStyle, setColorStyle] = useState(data.colorStyle || 'default');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, bulletList: false, orderedList: false,
        blockquote: false, codeBlock: false, code: false, horizontalRule: false,
      }),
      Table.configure({ resizable: editable, HTMLAttributes: { class: 'worksheet-table' } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: data.html || '<table><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>',
    editable,
    onUpdate: ({ editor: ed }) => {
      onChange({ ...data, html: ed.getHTML(), hasBorder, hasRoundedCorners, colorStyle });
    },
  });

  // Apply styles on mount and whenever editor/color/border changes
  useEffect(() => {
    if (editor) applyStyleToTable(hasBorder, hasRoundedCorners, colorStyle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, hasBorder, hasRoundedCorners, colorStyle]);

  // Apply CSS-variable-based colour/border styles to the <table> element
  const applyStyleToTable = (
    newBorder: boolean,
    newRounded: boolean,
    newColor: string,
  ) => {
    const table = containerRef.current?.querySelector('table') as HTMLElement | null;
    if (!table) return;
    table.classList.toggle('no-border', !newBorder);
    table.classList.toggle('no-rounded', !newRounded);
    const colors = COLOR_MAP[newColor];
    if (colors) {
      table.style.setProperty('--table-header-bg', colors.header);
      table.style.setProperty('--table-border-color', colors.border);
    } else {
      table.style.removeProperty('--table-header-bg');
      table.style.removeProperty('--table-border-color');
    }
  };

  const applyColor = (style: string) => {
    setColorStyle(style);
    applyStyleToTable(hasBorder, hasRoundedCorners, style);
    onChange({ ...data, html: editor?.getHTML() ?? data.html, colorStyle: style, hasBorder, hasRoundedCorners });
  };

  const toggleBorder = (v: boolean) => {
    setHasBorder(v);
    applyStyleToTable(v, hasRoundedCorners, colorStyle);
    onChange({ ...data, html: editor?.getHTML() ?? data.html, hasBorder: v, hasRoundedCorners, colorStyle });
  };

  const toggleRounded = (v: boolean) => {
    setHasRoundedCorners(v);
    applyStyleToTable(hasBorder, v, colorStyle);
    onChange({ ...data, html: editor?.getHTML() ?? data.html, hasRoundedCorners: v, hasBorder, colorStyle });
  };

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className="worksheet-table-container relative"
      style={{
        paddingTop: editable ? '50px' : '0',
        paddingBottom: editable ? '40px' : '0',
      }}
    >
      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>

      {editable && (
        <>
          {/* TOP row: Style dropdown | Add Row Before | Smazat dropdown */}
          <div
            className="flex justify-between items-center px-0"
            style={{ position: 'absolute', top: 8, left: 0, right: 0, zIndex: 9999, pointerEvents: 'none' }}
          >
            {/* Style dropdown */}
            <div className="relative" style={{ pointerEvents: 'auto' }}>
              <details className="table-dropdown">
                <summary className="table-dropdown-btn">
                  <span>Styl</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="table-dropdown-menu" style={{ minWidth: 200 }}>
                  <div className="table-dropdown-section-title">Barvy</div>
                  <div className="table-color-grid">
                    {[
                      { id: 'default', bg: '#f8fafc', border: '#94a3b8', title: 'Výchozí' },
                      { id: 'blue',   bg: '#dbeafe', border: '#3b82f6', title: 'Modrá' },
                      { id: 'green',  bg: '#dcfce7', border: '#22c55e', title: 'Zelená' },
                      { id: 'purple', bg: '#f3e8ff', border: '#a855f7', title: 'Fialová' },
                      { id: 'yellow', bg: '#fef3c7', border: '#f59e0b', title: 'Žlutá' },
                      { id: 'red',    bg: '#fee2e2', border: '#ef4444', title: 'Červená' },
                      { id: 'pink',   bg: '#fce7f3', border: '#ec4899', title: 'Růžová' },
                      { id: 'cyan',   bg: '#cffafe', border: '#06b6d4', title: 'Tyrkysová' },
                    ].map(c => (
                      <button
                        key={c.id}
                        onClick={() => applyColor(c.id)}
                        className="table-color-btn"
                        style={{ background: c.bg, borderColor: c.border }}
                        title={c.title}
                      />
                    ))}
                  </div>
                  <div className="table-dropdown-divider" />
                  <div className="table-dropdown-section-title">Nastavení</div>
                  <label className="table-dropdown-checkbox">
                    <input type="checkbox" checked={editor.isActive('tableHeader')}
                      onChange={() => editor.chain().focus().toggleHeaderRow().run()} />
                    <span>Záhlaví</span>
                  </label>
                  <label className="table-dropdown-checkbox">
                    <input type="checkbox" checked={hasBorder} onChange={e => toggleBorder(e.target.checked)} />
                    <span>Ohraničení</span>
                  </label>
                  <label className="table-dropdown-checkbox">
                    <input type="checkbox" checked={hasRoundedCorners} onChange={e => toggleRounded(e.target.checked)} />
                    <span>Zaoblené rohy</span>
                  </label>
                </div>
              </details>
            </div>

            {/* Add Row Before (top) */}
            <button
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="table-add-btn table-add-btn-blue"
              style={{ pointerEvents: 'auto' }}
              title="Přidat řádek nahoře"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat řádek</span>
            </button>

            {/* Delete dropdown */}
            <div className="relative" style={{ pointerEvents: 'auto' }}>
              <details className="table-dropdown">
                <summary className="table-dropdown-btn table-dropdown-btn-danger">
                  <span>Smazat</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="table-dropdown-menu table-dropdown-menu-right">
                  <button onClick={() => editor.chain().focus().deleteRow().run()}
                    className="table-dropdown-item table-dropdown-item-danger">Smazat řádek</button>
                  <button onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="table-dropdown-item table-dropdown-item-danger">Smazat sloupec</button>
                  <div className="table-dropdown-divider" />
                  <button onClick={() => editor.chain().focus().deleteTable().run()}
                    className="table-dropdown-item table-dropdown-item-danger-strong">Smazat celou tabulku</button>
                </div>
              </details>
            </div>
          </div>

          {/* Resize handle – bottom edge */}
          <div
            className="flex justify-center"
            style={{ position: 'absolute', bottom: 4, left: 0, right: 0, zIndex: 10000, pointerEvents: 'none' }}
          >
            <div
              className="table-resize-handle"
              style={{ pointerEvents: 'auto' }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const table = containerRef.current?.querySelector('table');
                if (!table) return;
                const startHeight = table.offsetHeight;
                const onMouseMove = (ev: MouseEvent) => {
                  const newHeight = Math.max(60, startHeight + ev.clientY - startY);
                  table.style.height = `${newHeight}px`;
                };
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  onChange({ ...data, html: editor.getHTML(), hasBorder, hasRoundedCorners, colorStyle });
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            />
          </div>

          {/* BOTTOM row: Add Column Left | Add Row After | Add Column Right */}
          <div
            className="flex justify-between items-center"
            style={{ position: 'absolute', bottom: -28, left: 0, right: 0, zIndex: 9999, pointerEvents: 'none' }}
          >
            <button
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="table-add-btn table-add-btn-green"
              style={{ pointerEvents: 'auto' }}
              title="Přidat sloupec vlevo"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat sloupec</span>
            </button>

            <button
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="table-add-btn table-add-btn-blue"
              style={{ pointerEvents: 'auto' }}
              title="Přidat řádek dole"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat řádek</span>
            </button>

            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="table-add-btn table-add-btn-green"
              style={{ pointerEvents: 'auto' }}
              title="Přidat sloupec vpravo"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat sloupec</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
