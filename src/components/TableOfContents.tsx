import { useState, useEffect, useRef } from 'react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentRef: React.RefObject<HTMLDivElement>;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

export function TableOfContents({ contentRef, scrollContainerRef }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const activeItemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    // Use a small delay to ensure content is fully rendered
    const timer = setTimeout(() => {
      if (!contentRef.current) return;
      
      // Extract headings from the content - only from visible desktop content to avoid duplicates
      const desktopContent = contentRef.current.querySelector('.hidden.lg\\:block');
      const contentToScan = desktopContent || contentRef.current;
      
      const elements = contentToScan.querySelectorAll('h2'); // Only H2, not H3
      const extractedHeadings: Heading[] = [];

      elements.forEach((element) => {
        const id = element.id || element.textContent?.toLowerCase().replace(/\s+/g, '-') || '';
        if (!element.id && id) {
          element.id = id;
        }
        
        extractedHeadings.push({
          id: element.id,
          text: element.textContent || '',
          level: parseInt(element.tagName.charAt(1))
        });
      });

      setHeadings(extractedHeadings);
    }, 100);

    return () => clearTimeout(timer);
  }, [contentRef.current?.innerHTML]);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -80% 0px',
      }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  // Auto-scroll active item into view in the menu container
  useEffect(() => {
    if (activeId && activeItemRef.current && scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      const activeElement = activeItemRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = activeElement.getBoundingClientRect();
      
      // Calculate the position of the element relative to the container
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.offsetHeight;
      const containerHeight = container.clientHeight;
      const containerScrollTop = container.scrollTop;
      
      // Check if element is outside visible area
      if (elementTop < containerScrollTop) {
        // Element is above visible area - scroll up
        container.scrollTo({
          top: elementTop - 20, // 20px padding from top
          behavior: 'smooth'
        });
      } else if (elementTop + elementHeight > containerScrollTop + containerHeight) {
        // Element is below visible area - scroll down
        container.scrollTo({
          top: elementTop - containerHeight + elementHeight + 20, // 20px padding from bottom
          behavior: 'smooth'
        });
      }
    }
  }, [activeId, scrollContainerRef]);

  if (headings.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Na této stránce najdete:</p>
      <nav>
        <ul className="space-y-1 text-sm">
          {headings.map((heading) => (
            <li
              key={heading.id}
              ref={activeId === heading.id ? activeItemRef : null}
              style={{
                paddingLeft: heading.level === 3 ? '0.75rem' : '0',
              }}
            >
              <a
                href={`#${heading.id}`}
                className={`
                  flex items-center gap-2 py-0.5 hover:text-foreground transition-colors
                  ${activeId === heading.id ? 'text-foreground font-medium' : 'text-muted-foreground'}
                `}
                onClick={(e) => {
                  e.preventDefault();
                  
                  // Immediately set active ID to trigger menu scroll
                  setActiveId(heading.id);
                  
                  // Scroll main content
                  document.getElementById(heading.id)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                  
                  // Also manually scroll the menu container if needed
                  if (scrollContainerRef?.current) {
                    const container = scrollContainerRef.current;
                    const clickedElement = e.currentTarget.parentElement as HTMLLIElement;
                    
                    if (clickedElement) {
                      const elementTop = clickedElement.offsetTop;
                      const elementHeight = clickedElement.offsetHeight;
                      const containerHeight = container.clientHeight;
                      const containerScrollTop = container.scrollTop;
                      
                      // Check if element is outside visible area and scroll it into view
                      if (elementTop < containerScrollTop) {
                        container.scrollTo({
                          top: elementTop - 20,
                          behavior: 'smooth'
                        });
                      } else if (elementTop + elementHeight > containerScrollTop + containerHeight) {
                        container.scrollTo({
                          top: elementTop - containerHeight + elementHeight + 20,
                          behavior: 'smooth'
                        });
                      }
                    }
                  }
                }}
              >
                {activeId === heading.id && (
                  <span className="text-primary">•</span>
                )}
                <span className={activeId === heading.id ? '' : 'ml-4'}>{heading.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
