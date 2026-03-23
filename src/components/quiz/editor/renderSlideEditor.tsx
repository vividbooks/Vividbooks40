import React from 'react';
import { QuizSlide, InfoSlide, Quiz, QuizSettings } from '../../../types/quiz';
import { SLIDE_TYPES } from '../slide-types';
import { ABCSlideEditor } from '../slides/ABCSlideEditor';
import { OpenSlideEditor } from '../slides/OpenSlideEditor';
import { ExampleSlideEditor } from '../slides/ExampleSlideEditor';
import { InfoSlideEditor } from '../slides/InfoSlideEditor';
import { BoardSlideEditor } from '../slides/BoardSlideEditor';
import { VotingSlideEditor } from '../slides/VotingSlideEditor';
import { FlashcardSlideEditor } from '../slides/FlashcardSlideEditor';
import { ConnectPairsEditor } from '../slides/ConnectPairsEditor';
import { FillBlanksEditor } from '../slides/FillBlanksEditor';
import { ImageHotspotsEditor } from '../slides/ImageHotspotsEditor';
import { VideoQuizEditor } from '../slides/VideoQuizEditor';
import { FormEditor } from '../slides/FormEditor';
import { CertificateEditor } from '../slides/CertificateEditor';

export function getSlideTitle(slide: QuizSlide): string {
  if (slide.type === 'info') {
    const infoSlide = slide as InfoSlide;
    const noteText = infoSlide.note ? infoSlide.note.replace(/<[^>]*>/g, '').substring(0, 50).trim() : '';

    if (infoSlide.layout?.blocks) {
      const headingBlock = infoSlide.layout.blocks.find(
        (b) => b.type === 'text' && (b.fontSize === 'xlarge' || b.fontWeight === 'bold')
      );
      if (headingBlock?.content) {
        return headingBlock.content.replace(/<[^>]*>/g, '').substring(0, 60).trim();
      }

      const textBlock = infoSlide.layout.blocks.find((b) => b.type === 'text' && b.content);
      if (textBlock?.content) {
        return textBlock.content.replace(/<[^>]*>/g, '').substring(0, 60).trim();
      }

      const linkBlock = infoSlide.layout.blocks.find((b) => b.type === 'link' && (b.linkTitle || b.content));
      if (linkBlock) {
        return linkBlock.linkTitle || linkBlock.content.replace(/<[^>]*>/g, '').substring(0, 60).trim();
      }

      const mediaBlock = infoSlide.layout.blocks.find((b) => b.type === 'image' || b.type === 'lottie');
      if (mediaBlock) {
        const label = mediaBlock.type === 'image' ? 'Obrázek' : 'Animace';
        const detail = mediaBlock.imageCaption || noteText;
        return detail ? `${label}: ${detail}` : label;
      }
    }

    if (noteText) return noteText;
    return slide.title || '';
  }

  if (slide.type === 'activity') {
    const activity = slide as any;
    if (activity.activityType === 'example' && activity.problem) {
      const problemText = activity.problem.replace(/<[^>]*>/g, '').substring(0, 50).trim();
      return activity.finalAnswer ? `${problemText}  →  ${activity.finalAnswer}` : problemText;
    }
    if (activity.activityType === 'flashcard') {
      return activity.word
        ? `${activity.word}${activity.translation ? ` → ${activity.translation}` : ''}`
        : 'Kartička';
    }
    if (activity.question) return activity.question.replace(/<[^>]*>/g, '').substring(0, 60).trim();
    if (activity.title) return activity.title;
    const typeLabel = SLIDE_TYPES.find((t) => t.activityType === activity.activityType)?.label;
    if (typeLabel) return typeLabel;
  }

  if (slide.type === 'tools') {
    const tool = slide as any;
    if (tool.toolType === 'certificate') {
      return tool.certificateConfig?.title || 'Certifikát';
    }
    const typeLabel = SLIDE_TYPES.find((t) => t.toolType === tool.toolType)?.label;
    if (typeLabel) return typeLabel;
  }

  return '';
}

export function renderSlideEditor(
  slide: QuizSlide,
  onUpdate: (id: string, updates: Partial<QuizSlide>) => void,
  onSlideClick?: () => void,
  selectedBlockIndex?: number | null,
  onBlockSelect?: (index: number | null) => void,
  onOpenBlockSettings?: (blockIndex: number, initialSection?: string) => void,
  onTextEditStart?: (blockIndex: number) => void,
  onTextEditEnd?: () => void,
  quiz?: Quiz | null,
  onQuizSettingsUpdate?: (settings: Partial<QuizSettings>) => void,
  datasetImages?: Array<{ url: string; title?: string; alt?: string }>
) {
  if (slide.type === 'info') {
    return (
      <InfoSlideEditor
        slide={slide as InfoSlide}
        onUpdate={onUpdate}
        selectedBlockIndex={selectedBlockIndex ?? null}
        onBlockSelect={onBlockSelect ?? (() => {})}
        onOpenBlockSettings={onOpenBlockSettings}
        onTextEditStart={onTextEditStart}
        onTextEditEnd={onTextEditEnd}
        datasetImages={datasetImages}
      />
    );
  }

  if (slide.type === 'activity') {
    const activity = slide as any;
    switch (activity.activityType) {
      case 'abc':
        return <ABCSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'open':
        return <OpenSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'example':
        return (
          <ExampleSlideEditor
            slide={activity}
            onUpdate={onUpdate}
            customKeys={quiz?.settings?.customKeys}
            onCustomKeysChange={
              onQuizSettingsUpdate ? (keys) => onQuizSettingsUpdate({ customKeys: keys }) : undefined
            }
            extraKeys={quiz?.settings?.extraKeys}
            onExtraKeysChange={
              onQuizSettingsUpdate ? (keys) => onQuizSettingsUpdate({ extraKeys: keys }) : undefined
            }
          />
        );
      case 'board':
        return <BoardSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'voting':
        return <VotingSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'connect-pairs':
        return <ConnectPairsEditor slide={activity} onUpdate={onUpdate} />;
      case 'fill-blanks':
        return <FillBlanksEditor slide={activity} onUpdate={onUpdate} />;
      case 'image-hotspots':
        return <ImageHotspotsEditor slide={activity} onUpdate={onUpdate} />;
      case 'video-quiz':
        return <VideoQuizEditor slide={activity} onUpdate={onUpdate} />;
      case 'form':
        return <FormEditor slide={activity} onUpdate={onUpdate} />;
      case 'flashcard':
        return <FlashcardSlideEditor slide={activity} onUpdate={onUpdate} />;
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            Editor pro tento typ aktivity ({activity.activityType}) zatím není k dispozici.
          </div>
        );
    }
  }

  if (slide.type === 'tools') {
    const toolSlide = slide as any;
    switch (toolSlide.toolType) {
      case 'certificate':
        return quiz ? <CertificateEditor slide={toolSlide} onUpdate={onUpdate} quiz={quiz} /> : null;
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            Editor pro tento typ nástroje ({toolSlide.toolType}) zatím není k dispozici.
          </div>
        );
    }
  }

  return null;
}
