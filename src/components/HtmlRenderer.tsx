import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { AlertTriangle, Info, Lightbulb, AlertCircle } from 'lucide-react';
import { PrintQRCode } from './PrintQRCode';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface HtmlRendererProps {
  content: string;
  readerMode?: boolean;
  hideMethodology?: boolean;
}

export function HtmlRenderer({ content, readerMode = false, hideMethodology = false }: HtmlRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [externalLinks, setExternalLinks] = useState<Array<{ url: string; text: string }>>([]);

  useEffect(() => {
    if (containerRef.current && content) {
      // Detect if content is Markdown or HTML
      let htmlContent = content;
      
      // Extended heuristic: detect common Markdown patterns
      const markdownPatterns = [
        /\*\*[^*]+\*\*/, // **bold**
        /\*[^*]+\*/,     // *italic*
        /\[[^\]]+\]\([^)]+\)/, // [link](url)
        /^#{1,6}\s/m,    // # headings
        /^[-*]\s/m,      // - or * lists
        /^\d+\.\s/m,     // 1. numbered lists
        /:::/,           // callouts
        /^>/m,           // > blockquotes
        /`[^`]+`/,       // `code`
      ];
      const isMarkdown = markdownPatterns.some(p => p.test(content)) && !content.trim().startsWith('<');
      
      if (isMarkdown) {
        // Process custom callouts/info boxes before markdown parsing
        let processedContent = content;
        
        // Process callout blocks: :::type ... :::
        processedContent = processedContent.replace(
          /:::(\w+)\s*(.*?)\n([\s\S]*?):::/g,
          (match, type, title, content) => {
            const trimmedContent = content.trim();
            return `<div data-type="callout" type="${type}" title="${title}">${trimmedContent}</div>`;
          }
        );

        // Process videos: ![video](url)
        processedContent = processedContent.replace(
          /!\[video\]\((.*?)\)/g,
          '<video src="$1" autoplay loop muted playsinline></video>'
        );

        htmlContent = marked.parse(processedContent) as string;
      }
      
      containerRef.current.innerHTML = htmlContent;

      // Add styling classes to rendered elements
      const container = containerRef.current;
      
      // Base text size class depending on reader mode
      const baseTextClass = readerMode ? 'text-xl md:text-2xl' : '';
      const baseLeadingClass = readerMode ? 'leading-loose' : 'leading-relaxed';
      
      // Process callouts and add icons - match both data-type="callout" and .callout class
      container.querySelectorAll('[data-type="callout"], .callout').forEach(el => {
        const div = el as HTMLElement;
        // Get type from various possible attributes
        const type = div.getAttribute('data-callout-type') || div.getAttribute('data-type') || div.getAttribute('type') || 
          (div.classList.contains('callout-summary') ? 'summary' : 
           div.classList.contains('callout-info') ? 'info' :
           div.classList.contains('callout-warning') ? 'warning' :
           div.classList.contains('callout-tip') ? 'tip' :
           div.classList.contains('callout-danger') ? 'danger' :
           div.classList.contains('callout-methodology') ? 'methodology' : 'info');
        const title = div.getAttribute('data-callout-title') || div.getAttribute('title') || '';
        
        // Hide methodology callouts for students
        if (type === 'methodology' && hideMethodology) {
          div.style.display = 'none';
          return;
        }
        
        // Check if this is a collapsible type
        const isCollapsible = type === 'summary' || type === 'methodology';
        
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
        div.className = `callout ${colorMap[type] || colorMap.info} border-l-4 p-3 md:p-4 mb-4 rounded-r ${textColorMap[type] || textColorMap.info} ${collapsibleClass}`;
        
        const iconHtml = getIconSvg(type);
        const originalContent = div.innerHTML;
        
        // Adjust callout text size in reader mode
        const calloutTitleSize = readerMode ? 'text-lg md:text-xl' : 'text-sm md:text-base';
        const calloutContentSize = readerMode ? 'text-lg md:text-xl' : 'text-sm md:text-base';
        
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
          
          // Clean minimal design with inline styles to override everything
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
                body.style.maxHeight = 'none'; // No limit - show all content
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
          // Regular non-collapsible structure
          div.innerHTML = `
            <div class="flex gap-2 md:gap-3">
              <div class="flex-shrink-0 mt-0.5">
                ${iconHtml}
              </div>
              <div class="flex-1 min-w-0">
                ${title ? `<div class="font-semibold mb-1 ${calloutTitleSize}">${title}</div>` : ''}
                <div class="callout-content ${calloutContentSize}">${originalContent}</div>
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
        if (!el.id) {
          el.id = el.textContent?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
        }
      });
      
      container.querySelectorAll('h3').forEach(el => {
        el.classList.add('mb-3', 'mt-6', 'first:mt-0');
        if (!el.id) {
          el.id = el.textContent?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
        }
      });
      
      container.querySelectorAll('h4').forEach(el => {
        el.classList.add('mb-3', 'mt-4', 'first:mt-0');
      });
      
      container.querySelectorAll('p').forEach(el => {
        el.classList.add('mb-4', baseLeadingClass);
        if (readerMode) el.classList.add('text-xl', 'md:text-2xl');
        // Fix for empty paragraphs collapsing
        if (el.innerHTML.trim() === '') {
           el.innerHTML = '&nbsp;';
        }
      });
      
      container.querySelectorAll('ul').forEach(el => {
        if (!el.closest('.callout-content')) {
          el.classList.add('mb-4', 'ml-6', 'list-disc', 'space-y-2');
        }
      });
      
      container.querySelectorAll('ol').forEach(el => {
        if (!el.closest('.callout-content')) {
          el.classList.add('mb-4', 'ml-6', 'list-decimal', 'space-y-4'); // Increased spacing for ordered lists
        }
      });
      
      container.querySelectorAll('li').forEach(el => {
        el.classList.add(baseLeadingClass);
        if (readerMode) el.classList.add('text-xl', 'md:text-2xl');
      });
      
      // Collect external links for QR codes in print mode
      const links: Array<{ url: string; text: string }> = [];
      container.querySelectorAll('a').forEach(el => {
        const anchor = el as HTMLAnchorElement;
        const href = anchor.getAttribute('href') || '';
        
        // Check if it's an internal link that should be styled as "bobánek" (pill)
        const isDocLink = href.startsWith('/docs/');
        const isLibraryLink = href.startsWith('/library/');
        const isQuizLink = href.startsWith('/quiz/');
        const isInternalLink = isDocLink || isLibraryLink || isQuizLink;
        
        if (isInternalLink) {
          // Determine icon based on URL path
          let iconSvg = '';
          let colorClasses = '';
          
          if (href.includes('/library/student/')) {
            // Student profile - user icon
            iconSvg = '<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>';
            colorClasses = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100';
          } else if (href.includes('/library/my-classes')) {
            // Class/results - bar chart icon
            iconSvg = '<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>';
            colorClasses = 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50 hover:bg-amber-100';
          } else if (isQuizLink) {
            // Quiz - play icon
            iconSvg = '<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
            colorClasses = 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/50 hover:bg-purple-100';
          } else if (isDocLink) {
            // Doc/lesson - book icon
            iconSvg = '<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>';
            colorClasses = 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-100';
          } else {
            // Other library links - folder icon
            iconSvg = '<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>';
            colorClasses = 'bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-900/50 hover:bg-slate-100';
          }
          
          // Add icon before text
          const originalText = anchor.innerHTML;
          anchor.innerHTML = iconSvg + '<span>' + originalText + '</span>';
          
          el.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] border transition-colors font-medium no-underline align-middle my-0.5 ${colorClasses}`;
        } else {
          el.classList.add('text-primary', 'underline', 'hover:no-underline');
        }
        
        // Track external links (not internal navigation)
        if (anchor.href && (anchor.href.startsWith('http://') || anchor.href.startsWith('https://')) && !anchor.href.includes(window.location.hostname)) {
          links.push({ 
            url: anchor.href, 
            text: anchor.textContent || anchor.href 
          });
          anchor.setAttribute('data-print-url', anchor.href);
        }
      });
      
      setExternalLinks(links);
      
      container.querySelectorAll('code').forEach(el => {
        if (!el.parentElement?.tagName.match(/PRE/i)) {
          el.classList.add(
            'bg-muted',
            'px-1.5',
            'py-0.5',
            'rounded',
            'font-mono'
          );
          // Scale inline code with text
          if (readerMode) {
             el.classList.add('text-lg', 'md:text-xl');
          } else {
             el.classList.add('text-sm');
          }
        }
      });
      
      container.querySelectorAll('pre').forEach(el => {
        el.classList.add(
          'bg-muted',
          'p-3',
          'md:p-4',
          'rounded-lg',
          'overflow-x-auto',
          'mb-4',
          'border',
          'border-border'
        );
        
        const code = el.querySelector('code');
        if (code) {
          code.classList.add('font-mono');
          if (readerMode) {
            code.classList.add('text-base', 'md:text-lg');
          } else {
            code.classList.add('text-xs', 'md:text-sm');
          }
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
        if (readerMode) el.classList.add('text-xl', 'md:text-2xl');
      });
      
      container.querySelectorAll('table').forEach(el => {
        // Wrap table in a container for horizontal scrolling
        if (!el.parentElement?.classList.contains('overflow-x-auto')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'overflow-x-auto mb-4';
          el.parentNode?.insertBefore(wrapper, el);
          wrapper.appendChild(el);
        }
        
        el.classList.add('w-full');
      });
      
      container.querySelectorAll('thead').forEach(el => {
        el.classList.add('bg-muted/50');
      });
      
      container.querySelectorAll('th').forEach(el => {
        el.classList.add(
          'border',
          'border-border',
          'px-2',
          'md:px-4',
          'py-2',
          'md:py-3',
          'text-left',
          'font-semibold'
        );
        if (readerMode) {
          el.classList.add('text-lg', 'md:text-xl');
        } else {
          el.classList.add('text-sm', 'md:text-base');
        }
      });
      
      container.querySelectorAll('td').forEach(el => {
        el.classList.add('border', 'border-border', 'px-2', 'md:px-4', 'py-2', 'md:py-3');
        if (readerMode) {
          el.classList.add('text-lg', 'md:text-xl');
        } else {
          el.classList.add('text-sm', 'md:text-base');
        }
      });
      
      container.querySelectorAll('img').forEach(el => {
        if (!el.classList.contains('max-w-full')) {
          el.classList.add('max-w-full', 'h-auto', 'rounded-lg', 'my-4', 'md:my-6', 'border', 'border-border');
        }
      });

      container.querySelectorAll('video').forEach(el => {
        if (!el.classList.contains('max-w-full')) {
          el.classList.add('max-w-full', 'h-auto', 'rounded-lg', 'my-4', 'md:my-6', 'border', 'border-border');
        }
      });

      // Process video embeds (YouTube, Loom, Vimeo)
      container.querySelectorAll('[data-type="video-embed"]').forEach(el => {
        const div = el as HTMLElement;
        const src = div.getAttribute('data-src');
        
        if (src && !div.querySelector('iframe')) {
          // Create iframe
          div.style.position = 'relative';
          div.style.paddingBottom = '56.25%';
          div.style.height = '0';
          div.style.overflow = 'hidden';
          div.style.maxWidth = '100%';
          div.style.margin = '1.5rem 0';
          
          const iframe = document.createElement('iframe');
          iframe.src = src;
          iframe.frameBorder = '0';
          iframe.allowFullscreen = true;
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
          iframe.style.position = 'absolute';
          iframe.style.top = '0';
          iframe.style.left = '0';
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.borderRadius = '0.5rem';
          
          div.appendChild(iframe);
        }
      });

      // Process iframe embeds (CodePen, JSFiddle, etc.)
      container.querySelectorAll('[data-type="iframe-embed"]').forEach(el => {
        const div = el as HTMLElement;
        let src = div.getAttribute('data-src') || '';
        const height = div.getAttribute('data-height') || '400';
        
        if (src && !div.querySelector('iframe')) {
          // Extract src from iframe tag if provided
          if (src.includes('<iframe')) {
            const srcMatch = src.match(/src=["'](.*?)["']/);
            if (srcMatch) {
              src = srcMatch[1];
            }
          }
          
          div.style.margin = '1.5rem 0';
          div.style.borderRadius = '0.5rem';
          div.style.overflow = 'hidden';
          div.style.border = '1px solid var(--border)';
          
          const iframe = document.createElement('iframe');
          iframe.src = src;
          iframe.style.width = '100%';
          iframe.style.height = height + 'px';
          iframe.style.border = 'none';
          iframe.frameBorder = '0';
          
          div.appendChild(iframe);
        }
      });

      // Process page link badges
      container.querySelectorAll('[data-type="page-link"]').forEach(el => {
        const span = el as HTMLElement;
        const category = span.getAttribute('data-category');
        const slug = span.getAttribute('data-slug');
        const title = span.getAttribute('data-title');
        
        if (category && slug && title) {
          const link = document.createElement('a');
          link.href = `/docs/${category}/${slug}`;
          link.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors font-medium no-underline mx-1';
          if (readerMode) {
            link.classList.add('text-lg');
          } else {
            link.classList.add('text-sm');
          }
          link.innerHTML = `
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ${title}
          `;
          
          span.replaceWith(link);
        }
      });

      // Process external link badges
      container.querySelectorAll('[data-type="external-link"]').forEach(el => {
        const span = el as HTMLElement;
        const href = span.getAttribute('data-href');
        const title = span.getAttribute('data-title');
        
        if (href && title) {
          const link = document.createElement('a');
          link.href = href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 border border-border transition-colors font-medium no-underline mx-1';
           if (readerMode) {
            link.classList.add('text-lg');
          } else {
            link.classList.add('text-sm');
          }
          link.innerHTML = `
            ${title}
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          `;
          
          span.replaceWith(link);
        }
      });
      
      container.querySelectorAll('hr').forEach(el => {
        el.classList.add('my-8', 'border-border');
      });

      // Render LaTeX formulas
      container.querySelectorAll('span[data-latex]').forEach(el => {
        const latex = el.getAttribute('data-latex');
        if (latex) {
          try {
            katex.render(latex, el as HTMLElement, {
              throwOnError: false,
              displayMode: false,
            });
          } catch (e) {
            // Keep original text on error
          }
        }
      });

      container.querySelectorAll('strong').forEach(el => {
        el.classList.add('font-semibold');
      });

      container.querySelectorAll('em').forEach(el => {
        el.classList.add('italic');
      });
    }
  }, [content, readerMode]);

  return (
    <>
      <div 
        ref={containerRef} 
        className={`prose prose-slate dark:prose-invert max-w-none html-renderer ${
          readerMode ? 'prose-xl md:prose-2xl' : ''
        }`}
      />
      
      {/* QR codes for external links - only visible in print */}
      {externalLinks.length > 0 && (
        <div className="hidden print:block mt-4 pt-4 border-t border-gray-300">
          <h3 className="text-10pt font-semibold mb-2">Externí odkazy a videa:</h3>
          <div className="grid grid-cols-1 gap-1">
            {externalLinks.map((link, index) => (
              <PrintQRCode 
                key={index} 
                url={link.url} 
                title={link.text}
                size={70}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function getIconSvg(type: string): string {
  const svgClass = 'w-5 h-5';
  
  switch (type) {
    case 'warning':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
    case 'info':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    case 'tip':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>`;
    case 'danger':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    case 'summary':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>`;
    case 'methodology':
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>`;
    default:
      return `<svg class="${svgClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  }
}
