import { AlertCircle, ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AnnotationStickerItem } from './sticker-library';
import { useStickerCatalog } from './sticker-library';

interface AnnotationStickerPanelProps {
  selectedSticker: AnnotationStickerItem | null;
  onSelectSticker: (sticker: AnnotationStickerItem) => void;
  stickerSize: number;
  onStickerSizeChange: (value: number) => void;
  pinnedRowId: string | null;
  onPinnedRowChange: (rowId: string | null) => void;
  onBack: () => void;
}

function getRowLabel(categoryId: string, row: number) {
  const categoryRowLabels: Record<string, string[]> = {
    emoji: ['Reakce', 'Tvary a emoce'],
    'numbers-and-signs': ['Čísla', 'Znaménka', 'Pomůcky'],
    dice: ['Kostky'],
    'geometric-symbols': ['Kolečka', 'Kříže', 'Čtverce', 'Trojúhelníky'],
    'color-symbols': ['Knoflíky', 'Půlměsíce', 'Jablka', 'Bonbony'],
    money: ['Mince'],
    'other-symbols': ['Plody', 'Předměty', 'Zvířata'],
    tables: ['Tabulky'],
  };

  return categoryRowLabels[categoryId]?.[row - 1] ?? `Řada ${row}`;
}

export function AnnotationStickerPanel({
  selectedSticker,
  onSelectSticker,
  stickerSize,
  onStickerSizeChange,
  pinnedRowId,
  onPinnedRowChange,
  onBack,
}: AnnotationStickerPanelProps) {
  const { categories, loading, error } = useStickerCatalog();
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  useEffect(() => {
    if (categories.length === 0) return;
    if (selectedCategoryId) return;
    setSelectedCategoryId(selectedSticker?.categoryId ?? categories[0].id);
  }, [categories, selectedCategoryId, selectedSticker?.categoryId]);

  useEffect(() => {
    if (!selectedSticker?.categoryId) return;
    setSelectedCategoryId(selectedSticker.categoryId);
  }, [selectedSticker?.categoryId]);

  const currentCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null;

  const selectedStickerRow = currentCategory?.rows.find((row) => row.row === selectedSticker?.row) ?? null;
  const pinnedRow = currentCategory?.rows.find((row) => row.id === pinnedRowId) ?? null;
  const currentRow = selectedStickerRow ?? pinnedRow ?? currentCategory?.rows[0] ?? null;
  const visibleStickers = currentRow?.items.slice(0, 10) ?? [];
  const hiddenCount = Math.max(0, (currentRow?.items.length ?? 0) - visibleStickers.length);

  const handleRowChange = (rowId: string) => {
    const nextCategory = categories.find((category) =>
      category.rows.some((row) => row.id === rowId),
    ) ?? null;
    const nextRow = nextCategory?.rows.find((row) => row.id === rowId) ?? null;
    if (nextCategory) {
      setSelectedCategoryId(nextCategory.id);
    }
    const nextSticker = nextRow?.items[0];
    onPinnedRowChange(rowId);
    if (nextSticker) {
      onSelectSticker(nextSticker);
    }
  };

  if (loading) {
    return (
      <div
        className="pointer-events-auto rounded-[24px] border shadow-xl overflow-x-auto max-w-[calc(100vw-120px)] px-3 py-2 flex items-center gap-3"
        style={{ backgroundColor: '#dbe1f0', borderColor: '#d5ddef', borderRadius: 24 }}
      >
        <Loader2 className="w-5 h-5 animate-spin text-[#5a6583]" />
        <span className="text-[14px] font-semibold text-[#55607d]">Nacitam nalepky...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="pointer-events-auto rounded-[24px] border shadow-xl overflow-x-auto max-w-[calc(100vw-120px)] px-3 py-2 flex items-center gap-3"
        style={{ backgroundColor: '#dbe1f0', borderColor: '#d5ddef', borderRadius: 24 }}
      >
        <AlertCircle className="w-5 h-5 text-[#ef4444]" />
        <span className="text-[14px] font-semibold text-[#55607d]">Sticker panel se nepodarilo nacist.</span>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto rounded-[24px] border shadow-xl overflow-x-auto max-w-[calc(100vw-120px)] px-3 py-2 flex items-center gap-3"
      style={{ backgroundColor: '#dbe1f0', borderColor: '#d5ddef', borderRadius: 24 }}
    >
      <button
        onClick={onBack}
        className="h-10 w-10 flex items-center justify-center flex-shrink-0"
        style={{
          borderRadius: 14,
          border: '1px solid #d8e0f0',
          backgroundColor: '#ffffff',
          color: '#55607d',
          boxShadow: '0 4px 12px rgba(89,99,127,0.08)',
        }}
        title="Zpět do toolbaru"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="relative flex-shrink-0">
        <select
          value={currentRow?.id ?? ''}
          onChange={(event) => handleRowChange(event.target.value)}
          className="h-10 appearance-none border bg-white pl-4 pr-10 text-[14px] font-semibold text-[#55607d] outline-none"
          style={{ borderColor: '#d8e0f0', borderRadius: 14, minWidth: 220 }}
        >
          {categories.flatMap((category) =>
            category.rows.map((row) => (
              <option key={row.id} value={row.id}>
                {category.label} - {getRowLabel(category.id, row.row)}
              </option>
            )),
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5f6b88]" />
      </div>

      <div
        className="flex items-center gap-2 min-w-0 flex-shrink"
        style={{
          height: '40px',
          padding: '0 10px',
          borderRadius: 14,
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 10px rgba(89,99,127,0.06)',
        }}
      >
        {visibleStickers.map((sticker) => {
          const isSelected = selectedSticker?.id === sticker.id;
          return (
            <button
              key={sticker.id}
              onClick={() => onSelectSticker(sticker)}
              className="w-10 h-10 rounded-[10px] border flex items-center justify-center overflow-hidden bg-[#f8faff] flex-shrink-0"
              style={{
                borderColor: isSelected ? 'transparent' : 'transparent',
                boxShadow: isSelected ? '0 0 0 2px rgba(89,99,127,0.18)' : 'none',
              }}
              title={sticker.name}
            >
              <img
                src={sticker.url}
                alt={sticker.name}
                className="max-w-[28px] max-h-[28px] object-contain pointer-events-none"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <span className="text-[12px] font-semibold text-[#8c97b5] flex-shrink-0">+{hiddenCount}</span>
      )}

      <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />

      <div className="flex flex-col justify-center gap-1 min-w-[180px] flex-shrink-0 self-stretch">
        <span className="text-[12px] font-semibold text-[#55607d] whitespace-nowrap leading-none">
          Velikost
        </span>
        <input
          type="range"
          min={50}
          max={300}
          step={5}
          value={stickerSize}
          onChange={(event) => onStickerSizeChange(Number(event.target.value))}
          className="w-[160px] accent-[#59637f]"
        />
      </div>
    </div>
  );
}
