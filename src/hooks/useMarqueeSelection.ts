import { useState, useRef, useEffect, RefObject } from 'react';

interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface UseMarqueeSelectionReturn {
  multiSelectedIds: string[];
  setMultiSelectedIds: (ids: string[]) => void;
  selectionRect: SelectionRect | null;
  scrollContainerRef: RefObject<HTMLDivElement>;
  handleMarqueeMouseDown: (e: React.MouseEvent) => void;
}

export function useMarqueeSelection(hasSlides: boolean): UseMarqueeSelectionReturn {
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const marqueeStartPos = useRef<{ x: number; y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const multiSelectedIdsRef = useRef(multiSelectedIds);

  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);

  const handleMarqueeMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-slide-id]')) return;

    setIsMarqueeSelecting(true);
    const startX = e.clientX;
    const startY = e.clientY;
    marqueeStartPos.current = { x: startX, y: startY };
    setSelectionRect({ x: startX, y: startY, w: 0, h: 0 });

    if (!e.shiftKey) {
      setMultiSelectedIds([]);
    }
  };

  useEffect(() => {
    if (!isMarqueeSelecting) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!marqueeStartPos.current) return;

      const x = Math.min(e.clientX, marqueeStartPos.current.x);
      const y = Math.min(e.clientY, marqueeStartPos.current.y);
      const w = Math.abs(e.clientX - marqueeStartPos.current.x);
      const h = Math.abs(e.clientY - marqueeStartPos.current.y);

      if (w < 8 && h < 8) return;

      setSelectionRect({ x, y, w, h });

      if (hasSlides && scrollContainerRef.current) {
        const items = scrollContainerRef.current.querySelectorAll('[data-slide-id]');
        const newSelectedIds: string[] = e.shiftKey ? [...multiSelectedIdsRef.current] : [];

        items.forEach((item) => {
          const rect = item.getBoundingClientRect();
          const slideId = item.getAttribute('data-slide-id');
          if (!slideId) return;

          const isInside = rect.left < x + w && rect.right > x && rect.top < y + h && rect.bottom > y;

          if (isInside) {
            if (!newSelectedIds.includes(slideId)) newSelectedIds.push(slideId);
          } else if (!e.shiftKey) {
            const idx = newSelectedIds.indexOf(slideId);
            if (idx > -1) newSelectedIds.splice(idx, 1);
          }
        });

        setMultiSelectedIds(newSelectedIds);
      }
    };

    const handleGlobalMouseUp = () => {
      setSelectionRect((prev) => {
        if (!prev || (prev.w < 8 && prev.h < 8)) {
          setMultiSelectedIds([]);
        }
        return null;
      });
      setIsMarqueeSelecting(false);
      marqueeStartPos.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isMarqueeSelecting, hasSlides]);

  return {
    multiSelectedIds,
    setMultiSelectedIds,
    selectionRect,
    scrollContainerRef,
    handleMarqueeMouseDown,
  };
}
