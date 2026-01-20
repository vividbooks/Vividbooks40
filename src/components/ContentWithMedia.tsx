import { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SectionMediaItem } from '../types/section-media';
import { LottieSequencePlayer } from './media/LottieSequencePlayer';

interface ContentWithMediaProps {
  content: string;
  sectionMedia: SectionMediaItem[];
}

export function ContentWithMedia({ content, sectionMedia }: ContentWithMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep track of roots to unmount them properly
  const rootsRef = useRef<Map<string, Root>>(new Map());

  useEffect(() => {
    if (!containerRef.current || sectionMedia.length === 0) return;

    const container = containerRef.current;

    // Cleanup previous roots if any
    rootsRef.current.forEach(root => root.unmount());
    rootsRef.current.clear();

    // Find all H2 elements
    const h2Elements = container.querySelectorAll('h2');
    
    h2Elements.forEach((h2) => {
      const h2Text = h2.textContent?.trim() || '';
      
      // Find matching section media
      const matchingMedia = sectionMedia.find(item => item.heading === h2Text);
      
      if (matchingMedia) {
        // Check if container already exists before this H2
        let mediaContainer = h2.previousElementSibling as HTMLElement;
        const isMediaContainer = mediaContainer && mediaContainer.classList.contains('section-media-container');
        
        if (!isMediaContainer) {
          // Create container
          mediaContainer = document.createElement('div');
          mediaContainer.className = 'section-media-container mb-6 rounded-lg overflow-hidden border border-border bg-card';
          h2.parentNode?.insertBefore(mediaContainer, h2);
        }

        // Create a unique ID for this mount point if needed, or just use the element
        if (matchingMedia.type === 'image') {
          // Simple image render
          mediaContainer.innerHTML = '';
          const img = document.createElement('img');
          img.src = matchingMedia.imageUrl || '';
          img.alt = `Illustration for ${h2Text}`;
          img.className = 'w-full h-auto';
          mediaContainer.appendChild(img);
        } else if (matchingMedia.type === 'lottie' && matchingMedia.lottieConfig) {
          // React Component Render for Lottie
          mediaContainer.innerHTML = ''; // Clear for React mount
          
          const root = createRoot(mediaContainer);
          rootsRef.current.set(matchingMedia.id, root);
          
          root.render(
            <LottieSequencePlayer 
              introUrl={matchingMedia.lottieConfig.introUrl}
              steps={matchingMedia.lottieConfig.steps}
              shouldLoop={matchingMedia.lottieConfig.shouldLoop}
              autoplay={matchingMedia.lottieConfig.autoplay}
              backgroundImage={matchingMedia.lottieConfig.backgroundImage}
            />
          );
        }
      }
    });

    // Cleanup function
    return () => {
      rootsRef.current.forEach(root => root.unmount());
      rootsRef.current.clear();
    };
  }, [content, sectionMedia]);

  return (
    <div 
      ref={containerRef}
      className="prose dark:prose-invert max-w-none content-with-media"
      dangerouslySetInnerHTML={{ __html: content }} 
    />
  );
}
