import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { AlertTriangle, Info, Lightbulb, AlertCircle } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  hideMethodology?: boolean;
}

export function MarkdownRenderer({ content, hideMethodology = false }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && content) {
      // Process custom callouts/info boxes before markdown parsing
      let processedContent = content;
      
      // Process callout blocks: :::type ... :::
      processedContent = processedContent.replace(
        /:::(\w+)\s*(.*?)\n([\s\S]*?):::/g,
        (match, type, title, content) => {
          const trimmedContent = content.trim();
          return `<div class="callout callout-${type}" data-title="${title}">${trimmedContent}</div>`;
        }
      );

      // Process videos: ![video](url)
      processedContent = processedContent.replace(
        /!\[video\]\((.*?)\)/g,
        '<video class="video-embed" src="$1" autoplay loop muted playsinline></video>'
      );

      const html = marked.parse(processedContent) as string;
      containerRef.current.innerHTML = html;

      // Add styling classes to rendered elements
      const container = containerRef.current;
      
      // Process callouts and add icons
      container.querySelectorAll('.callout').forEach(el => {
        const div = el as HTMLElement;
        const type = Array.from(div.classList).find(c => c.startsWith('callout-'))?.replace('callout-', '') || 'info';
        const title = div.getAttribute('data-title') || '';

        // Hide methodology callouts for students
        if (type === 'methodology' && hideMethodology) {
          div.style.display = 'none';
          return;
        }

        // Check if this is a collapsible type
        const isCollapsible = type === 'summary' || type === 'methodology';
        
        const iconMap: Record<string, string> = {
          warning: 'alert-triangle',
          info: 'info',
          tip: 'lightbulb',
          danger: 'alert-circle',
          summary: 'book-open',
          methodology: 'graduation-cap'
        };
        
        const colorMap: Record<string, string> = {
          warning: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-400 dark:border-yellow-600',
          info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600',
          tip: 'bg-green-50 dark:bg-green-950/30 border-green-400 dark:border-green-600',
          danger: 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-600',
          summary: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-600',
          methodology: 'bg-purple-50 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600'
        };

        const textColorMap: Record<string, string> = {
          warning: 'text-yellow-900 dark:text-yellow-200',
          info: 'text-blue-900 dark:text-blue-200',
          tip: 'text-green-900 dark:text-green-200',
          danger: 'text-red-900 dark:text-red-200',
          summary: 'text-indigo-900 dark:text-indigo-200',
          methodology: 'text-purple-900 dark:text-purple-200'
        };
        
        const collapsibleClass = isCollapsible ? 'callout-collapsible is-collapsed' : '';
        div.className = `callout ${colorMap[type] || colorMap.info} border-l-4 p-4 mb-4 rounded-r ${textColorMap[type] || textColorMap.info} ${collapsibleClass}`;
        
        const iconHtml = getIconSvg(iconMap[type] || 'info');
        const originalContent = div.innerHTML;
        
        if (isCollapsible) {
          // Check if there's an H2 in the content - use it as the title and remove from body
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = originalContent;
          const firstH2 = tempDiv.querySelector('h2');
          
          let calloutTitle = title || (type === 'summary' ? 'Shrnutí' : 'Metodická inspirace');
          let bodyContent = originalContent;
          
          if (firstH2) {
            calloutTitle = firstH2.textContent || calloutTitle;
            firstH2.remove();
            bodyContent = tempDiv.innerHTML;
          }
          
          const titleId = calloutTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
          const iconColor = type === 'summary' ? '#6366f1' : '#a855f7';
          const bgColor = type === 'summary' ? '#eef2ff' : '#faf5ff';
          
          // Clean minimal design with inline styles
          div.className = 'callout callout-collapsible';
          div.style.cssText = `background: ${bgColor}; border-radius: 12px; padding: 28px 24px; margin-bottom: 24px; border: none !important;`;
          
          // Start collapsed - body is hidden with inline styles
          div.innerHTML = `
            <div class="callout-header" style="display: flex; align-items: center; gap: 12px; cursor: pointer; user-select: none;">
              <div style="flex-shrink: 0; color: ${iconColor};">
                ${iconHtml.replace('w-5 h-5', 'w-6 h-6')}
              </div>
              <h2 id="${titleId}" style="flex: 1; margin: 0 !important; padding: 0 !important; border: none !important; font-size: 1.25rem; font-weight: 600; color: #334155;">${calloutTitle}</h2>
              <div style="flex-shrink: 0; color: #94a3b8;">
                <svg class="callout-toggle" style="width: 20px; height: 20px; transform: rotate(-90deg); transition: transform 0.2s ease;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
            <div class="callout-body" style="max-height: 0; overflow: hidden; opacity: 0; transition: all 0.3s ease;">
              <div style="padding-top: 16px; color: #475569;">
                ${bodyContent}
              </div>
            </div>
          `;
          
          // Add click handler to toggle
          const header = div.querySelector('.callout-header');
          const body = div.querySelector('.callout-body') as HTMLElement;
          const arrow = div.querySelector('.callout-toggle') as HTMLElement;
          
          if (header && body && arrow) {
            let isExpanded = false;
            
            header.addEventListener('click', (e) => {
              e.stopPropagation();
              isExpanded = !isExpanded;
              
              if (isExpanded) {
                body.style.maxHeight = '2000px';
                body.style.opacity = '1';
                body.style.marginTop = '0';
                body.style.paddingTop = '0';
                arrow.style.transform = 'rotate(90deg)';
              } else {
                body.style.maxHeight = '0';
                body.style.opacity = '0';
                body.style.marginTop = '0';
                body.style.paddingTop = '0';
                arrow.style.transform = 'rotate(-90deg)';
              }
            });
          }
        } else {
          div.innerHTML = `
            <div class="flex gap-3">
              <div class="flex-shrink-0 mt-0.5">
                ${iconHtml}
              </div>
              <div class="flex-1">
                ${title ? `<div class="font-semibold mb-1">${title}</div>` : ''}
                <div class="callout-content">${originalContent}</div>
              </div>
            </div>
          `;
        }
      });
      
      container.querySelectorAll('h1').forEach(el => {
        el.classList.add('mb-6', 'mt-8', 'first:mt-0', 'border-b', 'border-border', 'pb-2');
        // Add ID for table of contents
        if (!el.id) {
          el.id = el.textContent?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
        }
      });
      
      container.querySelectorAll('h2').forEach(el => {
        el.classList.add('mb-4', 'mt-8', 'first:mt-0', 'border-b', 'border-border', 'pb-2');
        // Add ID for table of contents
        if (!el.id) {
          el.id = el.textContent?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
        }
      });
      
      container.querySelectorAll('h3').forEach(el => {
        el.classList.add('mb-3', 'mt-6', 'first:mt-0');
        // Add ID for table of contents
        if (!el.id) {
          el.id = el.textContent?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
        }
      });
      
      container.querySelectorAll('h4').forEach(el => {
        el.classList.add('mb-3', 'mt-4', 'first:mt-0');
      });
      
      container.querySelectorAll('p').forEach(el => {
        el.classList.add('mb-4', 'leading-7');
      });
      
      container.querySelectorAll('ul').forEach(el => {
        // Skip if it's inside a callout
        if (!el.closest('.callout-content')) {
          el.classList.add('mb-4', 'ml-6', 'list-disc', 'space-y-2');
        }
      });
      
      container.querySelectorAll('ol').forEach(el => {
        if (!el.closest('.callout-content')) {
          el.classList.add('mb-4', 'ml-6', 'list-decimal', 'space-y-2');
        }
      });
      
      container.querySelectorAll('li').forEach(el => {
        el.classList.add('leading-7');
      });
      
      container.querySelectorAll('a').forEach(el => {
        el.classList.add('text-primary', 'underline', 'hover:no-underline');
      });
      
      container.querySelectorAll('code').forEach(el => {
        if (!el.parentElement?.tagName.match(/PRE/i)) {
          el.classList.add(
            'bg-muted',
            'px-1.5',
            'py-0.5',
            'rounded',
            'text-sm',
            'font-mono'
          );
        }
      });
      
      container.querySelectorAll('pre').forEach(el => {
        el.classList.add(
          'bg-muted',
          'p-4',
          'rounded-lg',
          'overflow-x-auto',
          'mb-4',
          'border',
          'border-border'
        );
        
        const code = el.querySelector('code');
        if (code) {
          code.classList.add('font-mono', 'text-sm');
        }
      });
      
      container.querySelectorAll('blockquote').forEach(el => {
        el.classList.add(
          'border-l-4',
          'border-primary',
          'pl-4',
          'py-2',
          'italic',
          'text-muted-foreground',
          'mb-4'
        );
      });
      
      container.querySelectorAll('table').forEach(el => {
        // Wrap table in a container for horizontal scrolling
        const wrapper = document.createElement('div');
        wrapper.className = 'overflow-x-auto mb-4 border border-border rounded-lg';
        el.parentNode?.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        
        el.classList.add('w-full', 'border-collapse');
      });
      
      container.querySelectorAll('thead').forEach(el => {
        el.classList.add('bg-muted/50');
      });
      
      container.querySelectorAll('th').forEach(el => {
        el.classList.add(
          'border',
          'border-border',
          'px-4',
          'py-3',
          'text-left',
          'font-semibold'
        );
      });
      
      container.querySelectorAll('td').forEach(el => {
        el.classList.add('border', 'border-border', 'px-4', 'py-3');
      });
      
      container.querySelectorAll('img').forEach(el => {
        el.classList.add('max-w-full', 'h-auto', 'rounded-lg', 'my-6', 'border', 'border-border');
      });

      container.querySelectorAll('.video-embed').forEach(el => {
        el.classList.add('max-w-full', 'h-auto', 'rounded-lg', 'my-6', 'border', 'border-border');
      });
      
      container.querySelectorAll('hr').forEach(el => {
        el.classList.add('my-8', 'border-border');
      });

      container.querySelectorAll('strong').forEach(el => {
        el.classList.add('font-semibold');
      });

      container.querySelectorAll('em').forEach(el => {
        el.classList.add('italic');
      });
    }
  }, [content]);

  return (
    <div 
      ref={containerRef} 
      className="prose prose-slate dark:prose-invert max-w-none"
    />
  );
}

function getIconSvg(icon: string): string {
  const svgClass = 'w-5 h-5';
  
  switch (icon) {
    case 'alert-triangle':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
    case 'info':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    case 'lightbulb':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>`;
    case 'alert-circle':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    case 'book-open':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>`;
    case 'graduation-cap':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>`;
    default:
      return '';
  }
}
