import { useEffect } from 'react';
import type { QuizSlide, InfoSlide } from '../../types/quiz';

export function useSlidePreload(
  currentSlideIndex: number,
  slides: QuizSlide[]
): void {
  useEffect(() => {
    const preloadSlideImages = (slide: QuizSlide | undefined) => {
      if (!slide) return;

      const imageUrls: string[] = [];

      if ((slide as any).media?.url && (slide as any).media?.type === 'image') {
        imageUrls.push((slide as any).media.url);
      }

      if (slide.type === 'info') {
        const infoSlide = slide as InfoSlide;
        if (infoSlide.layout?.blocks) {
          infoSlide.layout.blocks.forEach(block => {
            if (block.type === 'image' && block.content) {
              imageUrls.push(block.content);
              if (block.gallery) {
                block.gallery.forEach(url => imageUrls.push(url));
              }
            }
          });
        }
        if (infoSlide.imageUrl) {
          imageUrls.push(infoSlide.imageUrl);
        }
      }

      if (
        (slide as any).slideBackground?.type === 'image' &&
        (slide as any).slideBackground?.imageUrl
      ) {
        imageUrls.push((slide as any).slideBackground.imageUrl);
      }

      imageUrls.forEach(url => {
        if (url && url.startsWith('http')) {
          const img = new Image();
          img.src = url;
        }
      });
    };

    if (currentSlideIndex > 0) {
      preloadSlideImages(slides[currentSlideIndex - 1]);
    }
    if (currentSlideIndex < slides.length - 1) {
      preloadSlideImages(slides[currentSlideIndex + 1]);
    }
  }, [currentSlideIndex, slides]);
}
