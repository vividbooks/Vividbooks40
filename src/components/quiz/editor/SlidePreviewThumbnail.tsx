import React from 'react';
import {
  QuizSlide,
  InfoSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  FlashcardActivitySlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  FormActivitySlide,
} from '../../../types/quiz';
import { InfoSlideView } from '../slides/InfoSlideView';
import { ABCSlideView } from '../slides/ABCSlideView';
import { OpenSlideView } from '../slides/OpenSlideView';
import { BoardSlideView } from '../slides/BoardSlideView';
import { VotingSlideView } from '../slides/VotingSlideView';
import { FlashcardSlideView } from '../slides/FlashcardSlideView';
import { ConnectPairsView } from '../slides/ConnectPairsView';
import { FillBlanksView } from '../slides/FillBlanksView';
import { ImageHotspotsView } from '../slides/ImageHotspotsView';
import { VideoQuizView } from '../slides/VideoQuizView';
import { FormView } from '../slides/FormView';
import { ExampleActivityView } from '../ExampleActivityView';

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;

function FallbackThumbnail({ label = 'Náhled' }: { label?: string }) {
  return (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

function StaticScaledPreview({ children }: { children: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale =
    size.width > 0 && size.height > 0
      ? Math.min(size.width / PREVIEW_WIDTH, size.height / PREVIEW_HEIGHT)
      : 1;
  const scaledWidth = PREVIEW_WIDTH * scale;
  const scaledHeight = PREVIEW_HEIGHT * scale;
  const offsetX = Math.max(0, (size.width - scaledWidth) / 2);
  const offsetY = Math.max(0, (size.height - scaledHeight) / 2);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative bg-white">
      <div
        style={{
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          position: 'absolute',
          top: offsetY,
          left: offsetX,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function renderSlidePreview(slide: QuizSlide) {
  if (slide.type === 'info') {
    return <InfoSlideView slide={slide as InfoSlide} />;
  }

  if (slide.type !== 'activity') {
    return <FallbackThumbnail />;
  }

  switch ((slide as any).activityType) {
    case 'abc':
    case 'true-false':
      return (
        <ABCSlideView
          slide={slide as ABCActivitySlide}
          showHint={false}
          showSolution={false}
        />
      );
    case 'open':
      return <OpenSlideView slide={slide as OpenActivitySlide} answer="" disabled={true} />;
    case 'example':
      return (
        <ExampleActivityView
          slide={slide as ExampleActivitySlide}
          textAnswer=""
          setTextAnswer={() => {}}
          hasAnswered={false}
          showResults={false}
          showExplanation={false}
          onSubmit={() => {}}
        />
      );
    case 'board':
      return (
        <BoardSlideView
          slide={slide as BoardActivitySlide}
          posts={(slide as BoardActivitySlide).posts || []}
          isTeacher={true}
          readOnly={true}
        />
      );
    case 'voting':
      return (
        <VotingSlideView
          slide={slide as VotingActivitySlide}
          isTeacher={false}
          hasVoted={false}
          myVote={null}
          voteCounts={{}}
          totalVoters={0}
          readOnly={true}
        />
      );
    case 'flashcard':
      return <FlashcardSlideView slide={slide as FlashcardActivitySlide} />;
    case 'connect-pairs':
      return (
        <ConnectPairsView
          slide={slide as ConnectPairsActivitySlide}
          isTeacher={true}
          readOnly={true}
        />
      );
    case 'fill-blanks':
      return (
        <FillBlanksView
          slide={slide as FillBlanksActivitySlide}
          isTeacher={true}
          readOnly={true}
        />
      );
    case 'image-hotspots':
      return (
        <ImageHotspotsView
          slide={slide as ImageHotspotsActivitySlide}
          isTeacher={true}
          readOnly={true}
        />
      );
    case 'video-quiz':
      return (
        <VideoQuizView
          slide={slide as VideoQuizActivitySlide}
          isTeacher={true}
          readOnly={true}
        />
      );
    case 'form':
      return (
        <FormView
          slide={slide as FormActivitySlide}
          answer={{}}
          onAnswerChange={() => {}}
          isReadOnly={true}
        />
      );
    default:
      return <FallbackThumbnail />;
  }
}

export function SlidePreviewThumbnail({ slide }: { slide: QuizSlide }) {
  return <StaticScaledPreview>{renderSlidePreview(slide)}</StaticScaledPreview>;
}
