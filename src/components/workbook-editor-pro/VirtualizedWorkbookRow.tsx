import { memo, useEffect, useRef, useState, type ReactNode } from 'react';

interface VirtualizedWorkbookRowProps {
  estimatedHeight: number;
  children: ReactNode;
}

export const VirtualizedWorkbookRow = memo(function VirtualizedWorkbookRow({
  estimatedHeight,
  children,
}: VirtualizedWorkbookRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '1200px 0px' },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        minHeight: `${estimatedHeight}px`,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {isVisible ? (
        children
      ) : (
        <div
          style={{
            width: '100%',
            height: `${estimatedHeight}px`,
            borderRadius: '18px',
            background: 'rgba(30, 41, 59, 0.22)',
            border: '1px dashed rgba(148, 163, 184, 0.18)',
          }}
        />
      )}
    </div>
  );
});
