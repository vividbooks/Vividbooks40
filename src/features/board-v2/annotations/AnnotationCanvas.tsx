import { useEffect, useMemo, useRef, useState } from 'react';
import { getAnnotationSheetStyle } from './annotation-grid-presets';
import type {
  AnnotationActiveTool,
  AnnotationBrushKind,
  AnnotationImageObject,
  AnnotationLaserStroke,
  AnnotationObject,
  AnnotationPoint,
  AnnotationSlideSnapshot,
  AnnotationStrokeObject,
  AnnotationStrokeStyle,
  AnnotationTextObject,
} from './annotation-types';
import type { AnnotationStickerItem } from './sticker-library';

interface AnnotationCanvasProps {
  snapshot: AnnotationSlideSnapshot;
  activeTool: AnnotationActiveTool;
  interactionEnabled?: boolean;
  brushSize: number;
  brushColor: string;
  brushKind: AnnotationBrushKind;
  brushStrokeStyle: AnnotationStrokeStyle;
  textColor: string;
  textFontSize: number;
  stickerSize: number;
  selectedSticker: AnnotationStickerItem | null;
  selectedObjectId: string | null;
  onSelectedObjectIdChange: (id: string | null) => void;
  onCommitSnapshot: (nextSnapshot: AnnotationSlideSnapshot) => void;
}

const stickerDimensionsCache = new Map<string, Promise<{ width: number; height: number }>>();

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface DrawSession {
  pointerId: number;
  tool: 'brush' | 'laser';
  points: AnnotationPoint[];
}

interface TransformSession {
  pointerId: number;
  mode: 'move' | 'resize';
  objectId: string;
  startPoint: AnnotationPoint;
  originalObject: AnnotationObject;
  originalBounds: Bounds;
}

interface TextDraft {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

function clampPoint(point: AnnotationPoint): AnnotationPoint {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

function clampRect(x: number, y: number, width: number, height: number) {
  const nextWidth = Math.min(0.92, Math.max(0.04, width));
  const nextHeight = Math.min(0.92, Math.max(0.04, height));
  return {
    x: Math.min(1 - nextWidth, Math.max(0, x)),
    y: Math.min(1 - nextHeight, Math.max(0, y)),
    width: nextWidth,
    height: nextHeight,
  };
}

function getStrokeBounds(points: AnnotationPoint[]): Bounds {
  return points.reduce<Bounds>((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxX: Math.max(acc.maxX, point.x),
    maxY: Math.max(acc.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function getObjectBounds(object: AnnotationObject): Bounds {
  if (object.kind === 'stroke') {
    return getStrokeBounds(object.points);
  }

  return {
    minX: object.x,
    minY: object.y,
    maxX: object.x + object.width,
    maxY: object.y + object.height,
  };
}

function pointsToPath(points: AnnotationPoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x * width} ${point.y * height} L ${point.x * width + 0.1} ${point.y * height + 0.1}`;
  }

  return points.map((point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${command} ${point.x * width} ${point.y * height}`;
  }).join(' ');
}

function getStrokeDasharray(style: AnnotationStrokeStyle, size: number): string | undefined {
  if (style === 'dashed') {
    return `${size * 2.2} ${size * 1.6}`;
  }
  return undefined;
}

function getRenderedStrokeWidth(object: Pick<AnnotationStrokeObject, 'size' | 'brushKind'>): number {
  return object.brushKind === 'highlighter' ? object.size * 1.6 : object.size;
}

function getRenderedStrokeOpacity(object: Pick<AnnotationStrokeObject, 'brushKind'>): number {
  return object.brushKind === 'highlighter' ? 0.34 : 1;
}

function getRenderedStrokeDasharray(
  object: Pick<AnnotationStrokeObject, 'brushKind' | 'strokeStyle' | 'size'>,
): string | undefined {
  return object.brushKind === 'highlighter' ? undefined : getStrokeDasharray(object.strokeStyle, object.size);
}

function loadStickerDimensions(url: string) {
  const cached = stickerDimensionsCache.get(url);
  if (cached) return cached;

  const promise = new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
      });
    };
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = url;
  });

  stickerDimensionsCache.set(url, promise);
  return promise;
}

function translateObject(object: AnnotationObject, dx: number, dy: number): AnnotationObject {
  if (object.kind === 'stroke') {
    return {
      ...object,
      points: object.points.map((point) => clampPoint({ x: point.x + dx, y: point.y + dy })),
    };
  }

  const nextRect = clampRect(object.x + dx, object.y + dy, object.width, object.height);
  return {
    ...object,
    x: nextRect.x,
    y: nextRect.y,
    width: nextRect.width,
    height: nextRect.height,
  };
}

function scaleStrokeObject(object: AnnotationStrokeObject, nextBounds: Bounds): AnnotationStrokeObject {
  const originalBounds = getStrokeBounds(object.points);
  const originalWidth = Math.max(0.001, originalBounds.maxX - originalBounds.minX);
  const originalHeight = Math.max(0.001, originalBounds.maxY - originalBounds.minY);
  const nextWidth = Math.max(0.04, nextBounds.maxX - nextBounds.minX);
  const nextHeight = Math.max(0.04, nextBounds.maxY - nextBounds.minY);

  return {
    ...object,
    points: object.points.map((point) => clampPoint({
      x: nextBounds.minX + ((point.x - originalBounds.minX) / originalWidth) * nextWidth,
      y: nextBounds.minY + ((point.y - originalBounds.minY) / originalHeight) * nextHeight,
    })),
  };
}

function scaleRectObject<T extends AnnotationTextObject | AnnotationImageObject>(
  object: T,
  nextBounds: Bounds,
): T {
  const nextRect = clampRect(
    nextBounds.minX,
    nextBounds.minY,
    nextBounds.maxX - nextBounds.minX,
    nextBounds.maxY - nextBounds.minY,
  );
  return {
    ...object,
    x: nextRect.x,
    y: nextRect.y,
    width: nextRect.width,
    height: nextRect.height,
  };
}

function scaleObject(object: AnnotationObject, nextBounds: Bounds): AnnotationObject {
  if (object.kind === 'stroke') {
    return scaleStrokeObject(object, nextBounds);
  }
  return scaleRectObject(object, nextBounds);
}

export function AnnotationCanvas({
  snapshot,
  activeTool,
  interactionEnabled = true,
  brushSize,
  brushColor,
  brushKind,
  brushStrokeStyle,
  textColor,
  textFontSize,
  stickerSize,
  selectedSticker,
  selectedObjectId,
  onSelectedObjectIdChange,
  onCommitSnapshot,
}: AnnotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [drawSession, setDrawSession] = useState<DrawSession | null>(null);
  const [transformSession, setTransformSession] = useState<TransformSession | null>(null);
  const [previewObject, setPreviewObject] = useState<AnnotationObject | null>(null);
  const [laserStrokes, setLaserStrokes] = useState<AnnotationLaserStroke[]>([]);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [hoverPoint, setHoverPoint] = useState<AnnotationPoint | null>(null);
  const [hoverStickerAspectRatio, setHoverStickerAspectRatio] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      const rect = node.getBoundingClientRect();
      setCanvasSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    });

    observer.observe(node);
    const rect = node.getBoundingClientRect();
    setCanvasSize({
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedObjectId) return;
    if (!snapshot.objects.some((object) => object.id === selectedObjectId)) {
      onSelectedObjectIdChange(null);
    }
  }, [onSelectedObjectIdChange, selectedObjectId, snapshot.objects]);

  useEffect(() => {
    if (activeTool !== 'select') {
      onSelectedObjectIdChange(null);
    }
  }, [activeTool, onSelectedObjectIdChange]);

  useEffect(() => {
    if (!textDraft) return;
    const frame = window.requestAnimationFrame(() => {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [textDraft !== null]);

  useEffect(() => {
    if (!selectedSticker?.url) {
      setHoverStickerAspectRatio(1);
      return;
    }

    let cancelled = false;
    void loadStickerDimensions(selectedSticker.url).then(({ width, height }) => {
      if (!cancelled) {
        setHoverStickerAspectRatio(Math.max(0.2, width / Math.max(1, height)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSticker?.url]);

  useEffect(() => {
    if (laserStrokes.length === 0) return;

    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      setLaserStrokes((prev) => prev.filter((stroke) => stroke.expiresAt > currentTime));
    }, 50);

    return () => window.clearInterval(timer);
  }, [laserStrokes.length]);

  useEffect(() => {
    if (activeTool !== 'symbols' || !interactionEnabled || !selectedSticker) {
      setHoverPoint(null);
    }
  }, [activeTool, interactionEnabled, selectedSticker]);

  const renderedObjects = useMemo(() => {
    if (!previewObject) return snapshot.objects;
    return snapshot.objects.map((object) => (
      object.id === previewObject.id ? previewObject : object
    ));
  }, [previewObject, snapshot.objects]);

  const selectedObject = renderedObjects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedBounds = selectedObject ? getObjectBounds(selectedObject) : null;

  const captureBackground =
    interactionEnabled &&
    (
      activeTool === 'select' ||
      activeTool === 'brush' ||
      activeTool === 'laser' ||
      activeTool === 'text' ||
      activeTool === 'symbols' ||
      activeTool === 'eraser'
    );

  const stickerHoverPreview = useMemo(() => {
    if (!interactionEnabled || activeTool !== 'symbols' || !selectedSticker || !hoverPoint) {
      return null;
    }

    const aspectRatio = Math.max(0.2, hoverStickerAspectRatio);
    const targetOuterPx = Math.max(36, stickerSize * 0.7);
    let widthPx = targetOuterPx;
    let heightPx = targetOuterPx;

    if (aspectRatio >= 1) {
      heightPx = widthPx / aspectRatio;
    } else {
      widthPx = heightPx * aspectRatio;
    }

    const width = Math.min(0.42, Math.max(0.04, widthPx / canvasSize.width));
    const height = Math.min(0.42, Math.max(0.04, heightPx / canvasSize.height));
    const nextRect = clampRect(hoverPoint.x - width / 2, hoverPoint.y - height / 2, width, height);

    return {
      left: nextRect.x * canvasSize.width,
      top: nextRect.y * canvasSize.height,
      width: nextRect.width * canvasSize.width,
      height: nextRect.height * canvasSize.height,
      url: selectedSticker.url,
      alt: selectedSticker.name,
    };
  }, [
    activeTool,
    canvasSize.height,
    canvasSize.width,
    hoverPoint,
    hoverStickerAspectRatio,
    interactionEnabled,
    selectedSticker,
    stickerSize,
  ]);

  const getNormalizedPoint = (clientX: number, clientY: number): AnnotationPoint | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return clampPoint({
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    });
  };

  const commitTextDraft = () => {
    if (!textDraft) return;
    const nextText = textDraft.text.trim();
    if (!nextText) {
      setTextDraft(null);
      return;
    }

    const measuredHeight = textAreaRef.current
      ? Math.max(textAreaRef.current.scrollHeight + 8, textFontSize + 20) / canvasSize.height
      : textDraft.height;
    const nextRect = clampRect(textDraft.x, textDraft.y, textDraft.width, measuredHeight);

    onCommitSnapshot({
      ...snapshot,
      objects: [
        ...snapshot.objects,
        {
          id: crypto.randomUUID(),
          kind: 'text',
          x: nextRect.x,
          y: nextRect.y,
          width: nextRect.width,
          height: nextRect.height,
          text: nextText,
          color: textColor,
          fontSize: textFontSize,
        },
      ],
    });
    setTextDraft(null);
  };

  const startDraw = (point: AnnotationPoint, pointerId: number, tool: 'brush' | 'laser') => {
    svgRef.current?.setPointerCapture(pointerId);
    setPreviewObject(null);
    setTextDraft(null);
    setDrawSession({ pointerId, tool, points: [point] });
  };

  const placeSticker = async (point: AnnotationPoint, sticker: AnnotationStickerItem) => {
    const { width: naturalWidth, height: naturalHeight } = await loadStickerDimensions(sticker.url);
    const aspectRatio = Math.max(0.2, naturalWidth / Math.max(1, naturalHeight));
    const targetOuterPx = Math.max(36, stickerSize * 0.7);

    let widthPx = targetOuterPx;
    let heightPx = targetOuterPx;

    if (aspectRatio >= 1) {
      heightPx = widthPx / aspectRatio;
    } else {
      widthPx = heightPx * aspectRatio;
    }

    const width = Math.min(0.42, Math.max(0.04, widthPx / canvasSize.width));
    const height = Math.min(0.42, Math.max(0.04, heightPx / canvasSize.height));
    const nextRect = clampRect(point.x - width / 2, point.y - height / 2, width, height);

    onCommitSnapshot({
      ...snapshot,
      objects: [
        ...snapshot.objects,
        {
          id: crypto.randomUUID(),
          kind: 'image',
          x: nextRect.x,
          y: nextRect.y,
          width: nextRect.width,
          height: nextRect.height,
          url: sticker.url,
          alt: sticker.name,
        },
      ],
    });
  };

  const handleBackgroundPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    const point = getNormalizedPoint(event.clientX, event.clientY);
    if (!point) return;

    if (activeTool === 'brush' || activeTool === 'laser') {
      event.preventDefault();
      startDraw(point, event.pointerId, activeTool);
      return;
    }

    if (activeTool === 'text') {
      event.preventDefault();
      const nextRect = clampRect(point.x, point.y, 0.24, 0.12);
      setTextDraft({
        ...nextRect,
        text: 'Text',
      });
      onSelectedObjectIdChange(null);
      return;
    }

    if (activeTool === 'symbols' && selectedSticker) {
      event.preventDefault();
      void placeSticker(point, selectedSticker);
      onSelectedObjectIdChange(null);
      return;
    }

    if (activeTool === 'select') {
      onSelectedObjectIdChange(null);
    }
  };

  const handleObjectPointerDown = (event: React.PointerEvent<SVGElement>, object: AnnotationObject) => {
    event.stopPropagation();

    if (activeTool === 'eraser') {
      onCommitSnapshot({
        ...snapshot,
        objects: snapshot.objects.filter((item) => item.id !== object.id),
      });
      if (selectedObjectId === object.id) {
        onSelectedObjectIdChange(null);
      }
      return;
    }

    if (activeTool !== 'select') return;

    const point = getNormalizedPoint(event.clientX, event.clientY);
    if (!point) return;

    svgRef.current?.setPointerCapture(event.pointerId);
    onSelectedObjectIdChange(object.id);
    setTransformSession({
      pointerId: event.pointerId,
      mode: 'move',
      objectId: object.id,
      startPoint: point,
      originalObject: object,
      originalBounds: getObjectBounds(object),
    });
  };

  const handleResizePointerDown = (event: React.PointerEvent<SVGCircleElement>) => {
    if (!selectedObject || activeTool !== 'select' || !selectedBounds) return;
    event.stopPropagation();
    const point = getNormalizedPoint(event.clientX, event.clientY);
    if (!point) return;

    svgRef.current?.setPointerCapture(event.pointerId);
    setTransformSession({
      pointerId: event.pointerId,
      mode: 'resize',
      objectId: selectedObject.id,
      startPoint: point,
      originalObject: selectedObject,
      originalBounds: selectedBounds,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = getNormalizedPoint(event.clientX, event.clientY);
    if (!point) return;

    if (interactionEnabled && activeTool === 'symbols' && selectedSticker) {
      setHoverPoint(point);
    }

    if (drawSession && drawSession.pointerId === event.pointerId) {
      const lastPoint = drawSession.points[drawSession.points.length - 1];
      const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
      if (distance < 0.0025) return;
      setDrawSession({
        ...drawSession,
        points: [...drawSession.points, point],
      });
      return;
    }

    if (transformSession && transformSession.pointerId === event.pointerId) {
      if (transformSession.mode === 'move') {
        const dx = point.x - transformSession.startPoint.x;
        const dy = point.y - transformSession.startPoint.y;
        setPreviewObject(translateObject(transformSession.originalObject, dx, dy));
      } else {
        const nextBounds = {
          minX: transformSession.originalBounds.minX,
          minY: transformSession.originalBounds.minY,
          maxX: Math.max(transformSession.originalBounds.minX + 0.04, point.x),
          maxY: Math.max(transformSession.originalBounds.minY + 0.04, point.y),
        };
        setPreviewObject(scaleObject(transformSession.originalObject, nextBounds));
      }
    }
  };

  const finishDraw = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawSession || drawSession.pointerId !== event.pointerId) return;
    const points = drawSession.points;
    setDrawSession(null);

    if (drawSession.tool === 'laser') {
      if (points.length > 1) {
        setLaserStrokes((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            points,
            color: '#ef4444',
            size: brushSize,
            expiresAt: Date.now() + 850,
          },
        ]);
      }
      return;
    }

    if (points.length < 2) return;
    onCommitSnapshot({
      ...snapshot,
      objects: [
        ...snapshot.objects,
        {
          id: crypto.randomUUID(),
          kind: 'stroke',
          points,
          color: brushColor,
          size: brushSize,
          brushKind,
          strokeStyle: brushStrokeStyle,
        },
      ],
    });
  };

  const finishTransform = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!transformSession || transformSession.pointerId !== event.pointerId) return;
    const nextPreview = previewObject;
    setTransformSession(null);

    if (!nextPreview) return;

    onCommitSnapshot({
      ...snapshot,
      objects: snapshot.objects.map((object) => (
        object.id === nextPreview.id ? nextPreview : object
      )),
    });
    setPreviewObject(null);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    finishDraw(event);
    finishTransform(event);
  };

  const handlePointerCancel = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drawSession?.pointerId === event.pointerId) {
      setDrawSession(null);
    }
    if (transformSession?.pointerId === event.pointerId) {
      setTransformSession(null);
      setPreviewObject(null);
    }
    setHoverPoint(null);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {snapshot.sheetEnabled && (
        <div
          className="absolute inset-0"
          style={{
            ...getAnnotationSheetStyle(snapshot.sheetPreset),
            pointerEvents: 'none',
          }}
        />
      )}

      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => setHoverPoint(null)}
        style={{
          pointerEvents: interactionEnabled ? 'auto' : 'none',
          touchAction: 'none',
          cursor:
            interactionEnabled && activeTool === 'symbols' && selectedSticker
              ? 'none'
              : interactionEnabled && (activeTool === 'brush' || activeTool === 'laser')
                ? 'crosshair'
                : interactionEnabled && activeTool === 'text'
                  ? 'text'
                  : undefined,
        }}
      >
        {captureBackground && (
          <rect
            x={0}
            y={0}
            width={canvasSize.width}
            height={canvasSize.height}
            fill="rgba(0,0,0,0.001)"
            pointerEvents="all"
            onPointerDown={handleBackgroundPointerDown}
          />
        )}

        {renderedObjects.map((object) => {
          if (object.kind === 'stroke') {
            const path = pointsToPath(object.points, canvasSize.width, canvasSize.height);
            const dasharray = getRenderedStrokeDasharray(object);
            return (
              <g key={object.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={object.color}
                  strokeWidth={getRenderedStrokeWidth(object)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={dasharray}
                  className="pointer-events-none"
                  opacity={getRenderedStrokeOpacity(object)}
                  style={object.brushKind === 'highlighter' ? { mixBlendMode: 'multiply' } : undefined}
                />
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(18, getRenderedStrokeWidth(object) + 16)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents={interactionEnabled ? 'auto' : 'none'}
                  onPointerDown={(event) => handleObjectPointerDown(event, object)}
                />
              </g>
            );
          }

          if (object.kind === 'text') {
            return (
              <g key={object.id}>
                <foreignObject
                  x={object.x * canvasSize.width}
                  y={object.y * canvasSize.height}
                  width={object.width * canvasSize.width}
                  height={object.height * canvasSize.height}
                  className="pointer-events-none overflow-visible"
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      color: object.color,
                      fontSize: `${object.fontSize}px`,
                      lineHeight: 1.2,
                      fontWeight: 600,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      display: 'flex',
                      alignItems: 'flex-start',
                    }}
                  >
                    {object.text}
                  </div>
                </foreignObject>
                <rect
                  x={object.x * canvasSize.width}
                  y={object.y * canvasSize.height}
                  width={object.width * canvasSize.width}
                  height={object.height * canvasSize.height}
                  fill="transparent"
                  pointerEvents={interactionEnabled ? 'auto' : 'none'}
                  onPointerDown={(event) => handleObjectPointerDown(event, object)}
                />
              </g>
            );
          }

          return (
            <g key={object.id}>
              <image
                href={object.url}
                x={object.x * canvasSize.width}
                y={object.y * canvasSize.height}
                width={object.width * canvasSize.width}
                height={object.height * canvasSize.height}
                preserveAspectRatio="xMidYMid meet"
                className="pointer-events-none"
              />
              <rect
                x={object.x * canvasSize.width}
                y={object.y * canvasSize.height}
                width={object.width * canvasSize.width}
                height={object.height * canvasSize.height}
                fill="transparent"
                pointerEvents={interactionEnabled ? 'auto' : 'none'}
                onPointerDown={(event) => handleObjectPointerDown(event, object)}
              />
            </g>
          );
        })}

        {drawSession && (
          <path
            d={pointsToPath(drawSession.points, canvasSize.width, canvasSize.height)}
            fill="none"
            stroke={drawSession.tool === 'laser' ? '#ef4444' : brushColor}
            strokeWidth={drawSession.tool === 'laser' ? brushSize : getRenderedStrokeWidth({ size: brushSize, brushKind })}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={
              drawSession.tool === 'laser'
                ? `${brushSize * 2} ${brushSize * 1.2}`
                : getRenderedStrokeDasharray({
                    brushKind,
                    strokeStyle: brushStrokeStyle,
                    size: brushSize,
                  })
            }
            className="pointer-events-none"
            opacity={drawSession.tool === 'laser' ? 0.95 : getRenderedStrokeOpacity({ brushKind })}
            style={
              drawSession.tool === 'laser' || brushKind !== 'highlighter'
                ? undefined
                : { mixBlendMode: 'multiply' }
            }
          />
        )}

        {laserStrokes.map((stroke) => {
          const opacity = Math.max(0, (stroke.expiresAt - now) / 850);
          return (
            <path
              key={stroke.id}
              d={pointsToPath(stroke.points, canvasSize.width, canvasSize.height)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.size}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${stroke.size * 2} ${stroke.size * 1.2}`}
              className="pointer-events-none"
              opacity={opacity}
            />
          );
        })}

        {selectedBounds && activeTool === 'select' && (
          <g className="pointer-events-none">
            <rect
              x={selectedBounds.minX * canvasSize.width}
              y={selectedBounds.minY * canvasSize.height}
              width={(selectedBounds.maxX - selectedBounds.minX) * canvasSize.width}
              height={(selectedBounds.maxY - selectedBounds.minY) * canvasSize.height}
              rx={14}
              fill="none"
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="8 6"
            />
            <circle
              cx={selectedBounds.maxX * canvasSize.width}
              cy={selectedBounds.maxY * canvasSize.height}
              r={10}
              fill="#7c3aed"
              stroke="#ffffff"
              strokeWidth={3}
              pointerEvents={interactionEnabled ? 'auto' : 'none'}
              className="cursor-se-resize"
              onPointerDown={handleResizePointerDown}
            />
          </g>
        )}
      </svg>

      {stickerHoverPreview && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            style={{
              position: 'absolute',
              left: stickerHoverPreview.left,
              top: stickerHoverPreview.top,
              width: stickerHoverPreview.width,
              height: stickerHoverPreview.height,
              opacity: 0.38,
              filter: 'drop-shadow(0 4px 10px rgba(15,23,42,0.18))',
            }}
          >
            <img
              src={stickerHoverPreview.url}
              alt={stickerHoverPreview.alt}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

      {textDraft && (
        <div className="absolute inset-0 pointer-events-none">
          <textarea
            ref={textAreaRef}
            value={textDraft.text}
            onChange={(event) => setTextDraft((prev) => (prev ? { ...prev, text: event.target.value } : prev))}
            onBlur={commitTextDraft}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                commitTextDraft();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setTextDraft(null);
              }
            }}
            className="absolute pointer-events-auto resize-none rounded-xl border border-violet-300 bg-white/96 px-3 py-2 shadow-lg outline-none"
            style={{
              left: textDraft.x * canvasSize.width,
              top: textDraft.y * canvasSize.height,
              width: textDraft.width * canvasSize.width,
              minHeight: textDraft.height * canvasSize.height,
              color: textColor,
              fontSize: `${textFontSize}px`,
              lineHeight: 1.2,
              fontWeight: 600,
            }}
          />
        </div>
      )}
    </div>
  );
}
