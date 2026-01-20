import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, GripVertical, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export interface TableData {
  id: string;
  rows: string[][];
  hasHeader: boolean;
}

interface TableBlockProps {
  data: TableData;
  onChange: (data: TableData) => void;
  editable?: boolean;
}

export function TableBlock({ data, onChange, editable = true }: TableBlockProps) {
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...data.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][colIndex] = value;
    onChange({ ...data, rows: newRows });
  };

  const addRow = (afterIndex?: number) => {
    const colCount = data.rows[0]?.length || 3;
    const newRow = Array(colCount).fill('');
    const newRows = [...data.rows];
    const insertIndex = afterIndex !== undefined ? afterIndex + 1 : newRows.length;
    newRows.splice(insertIndex, 0, newRow);
    onChange({ ...data, rows: newRows });
  };

  const addColumn = (afterIndex?: number) => {
    const newRows = data.rows.map(row => {
      const newRow = [...row];
      const insertIndex = afterIndex !== undefined ? afterIndex + 1 : newRow.length;
      newRow.splice(insertIndex, 0, '');
      return newRow;
    });
    onChange({ ...data, rows: newRows });
  };

  const deleteRow = (rowIndex: number) => {
    if (data.rows.length <= 1) return;
    const newRows = data.rows.filter((_, i) => i !== rowIndex);
    onChange({ ...data, rows: newRows });
  };

  const deleteColumn = (colIndex: number) => {
    if (data.rows[0]?.length <= 1) return;
    const newRows = data.rows.map(row => row.filter((_, i) => i !== colIndex));
    onChange({ ...data, rows: newRows });
  };

  const toggleHeader = () => {
    onChange({ ...data, hasHeader: !data.hasHeader });
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const maxRow = data.rows.length - 1;
    const maxCol = data.rows[0].length - 1;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Move left or to previous row
        if (colIndex > 0) {
          setFocusedCell({ row: rowIndex, col: colIndex - 1 });
        } else if (rowIndex > 0) {
          setFocusedCell({ row: rowIndex - 1, col: maxCol });
        }
      } else {
        // Move right or to next row
        if (colIndex < maxCol) {
          setFocusedCell({ row: rowIndex, col: colIndex + 1 });
        } else if (rowIndex < maxRow) {
          setFocusedCell({ row: rowIndex + 1, col: 0 });
        } else {
          // Add new row at the end
          addRow();
          setFocusedCell({ row: rowIndex + 1, col: 0 });
        }
      }
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      setFocusedCell({ row: rowIndex - 1, col: colIndex });
    } else if (e.key === 'ArrowDown' && rowIndex < maxRow) {
      setFocusedCell({ row: rowIndex + 1, col: colIndex });
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (rowIndex < maxRow) {
        setFocusedCell({ row: rowIndex + 1, col: colIndex });
      } else {
        addRow();
        setFocusedCell({ row: rowIndex + 1, col: colIndex });
      }
    }
  };

  return (
    <div className="my-4 group relative">
      {/* Table controls */}
      {editable && (
        <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <button
            onClick={toggleHeader}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              data.hasHeader 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Záhlaví
          </button>
          <button
            onClick={() => addColumn()}
            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
            title="Přidat sloupec"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => addRow()}
            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
            title="Přidat řádek"
          >
            <Plus className="h-4 w-4 rotate-90" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table ref={tableRef} className="w-full border-collapse">
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className={`
                  ${rowIndex === 0 && data.hasHeader ? 'bg-slate-50' : 'bg-white'}
                  ${rowIndex > 0 ? 'border-t border-slate-200' : ''}
                  group/row
                `}
              >
                {row.map((cell, colIndex) => {
                  const isHeader = rowIndex === 0 && data.hasHeader;
                  const CellTag = isHeader ? 'th' : 'td';
                  const isFocused = focusedCell?.row === rowIndex && focusedCell?.col === colIndex;

                  return (
                    <CellTag
                      key={colIndex}
                      className={`
                        relative p-0
                        ${colIndex > 0 ? 'border-l border-slate-200' : ''}
                        ${isHeader ? 'font-semibold text-slate-700' : 'text-slate-600'}
                      `}
                    >
                      {editable ? (
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
                          onBlur={() => setFocusedCell(null)}
                          className={`
                            w-full px-3 py-2.5 bg-transparent outline-none
                            ${isHeader ? 'font-semibold' : ''}
                            ${isFocused ? 'ring-2 ring-blue-500 ring-inset' : ''}
                            placeholder:text-slate-300
                          `}
                          placeholder={isHeader ? 'Záhlaví' : ''}
                          autoFocus={isFocused}
                        />
                      ) : (
                        <span className="block px-3 py-2.5">{cell}</span>
                      )}

                      {/* Cell context menu */}
                      {editable && isFocused && (
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 bg-white shadow-md rounded hover:bg-slate-50">
                                <MoreHorizontal className="h-3 w-3 text-slate-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="right">
                              <DropdownMenuItem onClick={() => addRow(rowIndex)}>
                                Přidat řádek pod
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addColumn(colIndex)}>
                                Přidat sloupec vpravo
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteRow(rowIndex)}
                                className="text-red-600"
                                disabled={data.rows.length <= 1}
                              >
                                Smazat řádek
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteColumn(colIndex)}
                                className="text-red-600"
                                disabled={data.rows[0]?.length <= 1}
                              >
                                Smazat sloupec
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </CellTag>
                  );
                })}

                {/* Row delete button */}
                {editable && (
                  <td className="w-8 p-0 border-l border-slate-100 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="w-full h-full p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Smazat řádek"
                      disabled={data.rows.length <= 1}
                    >
                      <Trash2 className="h-3 w-3 mx-auto" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row button at bottom */}
      {editable && (
        <button
          onClick={() => addRow()}
          className="w-full mt-1 py-1.5 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border border-dashed border-slate-200 hover:border-slate-300 transition-all opacity-0 group-hover:opacity-100"
        >
          + Přidat řádek
        </button>
      )}
    </div>
  );
}

// Dialog for creating new table
interface CreateTableDialogProps {
  onCreateTable: (rows: number, cols: number, hasHeader: boolean) => void;
  onClose: () => void;
}

export function CreateTableDialog({ onCreateTable, onClose }: CreateTableDialogProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [hasHeader, setHasHeader] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const maxGridSize = 8;

  const handleCreate = () => {
    onCreateTable(rows, cols, hasHeader);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl p-6 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Vložit tabulku</h3>
        
        {/* Grid selector */}
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-2">
            {hoveredCell ? `${hoveredCell.row} × ${hoveredCell.col}` : `${rows} × ${cols}`}
          </p>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maxGridSize}, 20px)` }}>
            {Array.from({ length: maxGridSize * maxGridSize }).map((_, idx) => {
              const rowIdx = Math.floor(idx / maxGridSize);
              const colIdx = idx % maxGridSize;
              const isSelected = rowIdx < rows && colIdx < cols;
              const isHovered = hoveredCell && rowIdx < hoveredCell.row && colIdx < hoveredCell.col;
              return (
                <button
                  key={idx}
                  className={`w-5 h-5 rounded-sm border transition-colors ${
                    isHovered || isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-slate-100 border-slate-200 hover:border-blue-300'
                  }`}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx + 1, col: colIdx + 1 })}
                  onMouseLeave={() => setHoveredCell(null)}
                  onClick={() => {
                    setRows(rowIdx + 1);
                    setCols(colIdx + 1);
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Header toggle */}
        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">První řádek jako záhlaví</span>
        </label>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 py-2 px-4 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Vložit
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to create empty table data
export function createEmptyTable(rows: number = 3, cols: number = 3, hasHeader: boolean = true): TableData {
  return {
    id: `table-${Date.now()}`,
    rows: Array.from({ length: rows }, () => Array(cols).fill('')),
    hasHeader,
  };
}

export default TableBlock;


