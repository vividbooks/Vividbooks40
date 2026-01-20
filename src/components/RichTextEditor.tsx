import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { ResizableImageComponent } from './ResizableImageComponent';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Mark, mergeAttributes, Node as TiptapNode } from '@tiptap/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { CreateTableDialog } from './TableBlock';

// LaTeX Node Component for React
const LaTeXNodeView = ({ node, updateAttributes }: any) => {
  const { latex } = node.attrs;
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current && latex) {
      try {
        katex.render(latex, containerRef.current, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (e) {
        containerRef.current.textContent = latex;
      }
    }
  }, [latex]);

  return (
    <NodeViewWrapper as="span" className="latex-node">
      <span 
        ref={containerRef} 
        className="latex-content cursor-pointer hover:bg-blue-50 rounded px-1"
        title={`LaTeX: ${latex}`}
        onClick={() => {
          const newLatex = prompt('Upravit LaTeX vzorec:', latex);
          if (newLatex !== null) {
            updateAttributes({ latex: newLatex });
          }
        }}
      />
    </NodeViewWrapper>
  );
};

// Custom LaTeX Node Extension
const LaTeXNode = TiptapNode.create({
  name: 'latex',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-latex]',
        getAttrs: (dom: HTMLElement) => ({
          latex: dom.getAttribute('data-latex'),
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return ['span', { 'data-latex': node.attrs.latex, class: 'latex-inline' }, node.attrs.latex];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LaTeXNodeView);
  },

  addCommands() {
    return {
      insertLatex: (latex: string) => ({ commands }: any) => {
        return commands.insertContent({
          type: 'latex',
          attrs: { latex },
        });
      },
    } as any;
  },
});

// Custom Underline extension (no package needed)
const CustomUnderline = Mark.create({
  name: 'underline',
  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration=underline' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleUnderline: () => ({ commands }) => commands.toggleMark(this.name),
    };
  },
});

// Custom TextStyle extension for colors and font size
const CustomTextStyle = Mark.create({
  name: 'textStyle',
  
  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.color || null,
        renderHTML: (attributes: { color?: string; fontSize?: string }) => {
          const styles: string[] = [];
          if (attributes.color) styles.push(`color: ${attributes.color}`);
          if (attributes.fontSize) styles.push(`font-size: ${attributes.fontSize}`);
          if (styles.length === 0) return {};
          return { style: styles.join('; ') };
        },
      },
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: () => ({}), // Handled by color's renderHTML
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element: HTMLElement) => {
          const hasColor = element.style.color;
          const hasFontSize = element.style.fontSize;
          if (!hasColor && !hasFontSize) return false;
          return {};
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

// Custom Highlight extension
const CustomHighlight = Mark.create({
  name: 'highlight',
  
  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      color: {
        default: '#fef08a',
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || '#fef08a',
        renderHTML: (attributes: { color?: string }) => {
          return { 
            style: `background-color: ${attributes.color}; padding: 0.1em 0.2em; border-radius: 0.2em;` 
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Heading3,
  Quote,
  Code,
  ImageIcon,
  Link as LinkIcon,
  AlertTriangle,
  Info,
  Lightbulb,
  AlertCircle,
  Video,
  Undo,
  Redo,
  Minus,
  ExternalLink,
  FileText,
  Code2,
  ChevronDown,
  BookOpen,
  GraduationCap,
  Table as TableIcon,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  CheckSquare,
  ListChecks,
  Sigma,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
} from 'lucide-react';
import { Callout, VideoEmbed, IframeEmbed, PageLink, ExternalLinkBadge } from './RichTextEditorExtensions';
import { CalloutNodeView } from './CalloutNodeView';
import { DocumentLinkPicker } from './DocumentLinkPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';

// Extended Callout with React NodeView for visual styling in editor
const ReactiveCallout = Callout.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});

const ResizableImage = ImageExtension.extend({
  addOptions() {
    return {
      ...(this.parent?.() ?? {}),
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded-lg my-6',
      },
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('style'),
        renderHTML: (attributes: { style?: string }) => {
          if (!attributes.style) {
            return {};
          }
          return { style: attributes.style };
        },
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width'),
        renderHTML: (attributes: { width?: string }) => {
          if (!attributes.width) {
            return {};
          }
          return { width: attributes.width };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  // Paste detection for student assignments
  enablePasteDetection?: boolean;
  onPasteDetected?: (pastedText: string, wordCount: number) => void;
  // Selection tracking for AI Canvas-like features
  onSelectionChange?: (selection: { text: string; html: string; from: number; to: number } | null) => void;
  // Ref to expose editor methods
  editorRef?: React.MutableRefObject<{
    replaceSelection: (html: string) => void;
    getSelectedText: () => string;
    getSelectedHtml: () => string;
  } | null>;
}

interface Page {
  id: string;
  slug: string;
  title: string;
  category: string;
}

interface Category {
  id: string;
  label: string;
}

export function RichTextEditor({ 
  content, 
  onChange, 
  readOnly = false,
  enablePasteDetection = false,
  onPasteDetected,
  onSelectionChange,
  editorRef,
}: RichTextEditorProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showPasteSourceDialog, setShowPasteSourceDialog] = useState(false);
  const [pendingPasteText, setPendingPasteText] = useState('');
  const [pasteSource, setPasteSource] = useState('');
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showPageLinkDialog, setShowPageLinkDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showLatexDialog, setShowLatexDialog] = useState(false);
  const [latexInput, setLatexInput] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const highlightButtonRef = useRef<HTMLButtonElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [tableRect, setTableRect] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null);
  
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedHeight, setEmbedHeight] = useState('400');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [imageSearch, setImageSearch] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);
  const [videoProvider, setVideoProvider] = useState<'youtube' | 'loom' | 'vimeo'>('youtube');

  // Page link states
  const [pages, setPages] = useState<Page[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [filteredPages, setFilteredPages] = useState<Page[]>([]);
  
  // Store selection before dropdown opens (so we don't lose it when focus moves to dropdown)
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // @ts-ignore
        link: false,
      }),
      ResizableImage,
      CustomUnderline,
      CustomTextStyle,
      CustomHighlight,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline hover:no-underline',
        },
      }),
      ReactiveCallout,
      VideoEmbed,
      IframeEmbed,
      PageLink,
      ExternalLinkBadge,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Subscript,
      Superscript,
      LaTeXNode,
    ],
    content: content || '',
    editorProps: {
      attributes: {
          class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] tiptap-editor [&_p]:min-h-[1.5em] [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:pl-1',
      },
      handlePaste: enablePasteDetection ? (view, event, slice) => {
        const pastedText = event.clipboardData?.getData('text/plain') || '';
        const wordCount = pastedText.trim().split(/\s+/).filter(w => w.length > 0).length;
        
        // If more than 2 words pasted, show source dialog
        if (wordCount > 2) {
          setPendingPasteText(pastedText);
          setShowPasteSourceDialog(true);
          onPasteDetected?.(pastedText, wordCount);
          // Don't prevent paste, just show dialog
        }
        return false; // Let TipTap handle the paste normally
      } : undefined,
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      if (onSelectionChange) {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          // There is a selection
          const text = editor.state.doc.textBetween(from, to, ' ');
          // Get HTML of selection
          const slice = editor.state.doc.slice(from, to);
          const tempDiv = document.createElement('div');
          const fragment = slice.content;
          // Convert fragment to HTML string
          let html = '';
          fragment.forEach((node: any) => {
            const serializer = editor.schema.serializers?.DOMSerializer || 
              (editor.schema as any).cached?.domSerializer ||
              require('@tiptap/pm/model').DOMSerializer.fromSchema(editor.schema);
            const dom = serializer.serializeNode(node);
            const wrapper = document.createElement('div');
            wrapper.appendChild(dom);
            html += wrapper.innerHTML;
          });
          onSelectionChange({ text, html: html || text, from, to });
        } else {
          onSelectionChange(null);
        }
      }
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);
  
  // Track last selection position (persists even when focus is lost)
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
  
  // Update last selection when selection changes
  useEffect(() => {
    if (editor) {
      const updateSelection = () => {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          lastSelectionRef.current = { from, to };
        }
      };
      
      editor.on('selectionUpdate', updateSelection);
      return () => {
        editor.off('selectionUpdate', updateSelection);
      };
    }
  }, [editor]);
  
  // Expose editor methods via ref
  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = {
        replaceSelection: (html: string) => {
          // Use stored selection position (doesn't rely on current focus)
          const selection = lastSelectionRef.current;
          if (selection && selection.from !== selection.to) {
            // Delete the range and insert new content
            editor
              .chain()
              .focus()
              .setTextSelection({ from: selection.from, to: selection.to })
              .deleteSelection()
              .insertContent(html)
              .run();
            // Clear the stored selection
            lastSelectionRef.current = null;
          }
        },
        getSelectedText: () => {
          const { from, to } = editor.state.selection;
          return editor.state.doc.textBetween(from, to, ' ');
        },
        getSelectedHtml: () => {
          const { from, to } = editor.state.selection;
          const slice = editor.state.doc.slice(from, to);
          let html = '';
          slice.content.forEach((node: any) => {
            const dom = (editor.schema as any).cached?.domSerializer?.serializeNode(node);
            if (dom) {
              const wrapper = document.createElement('div');
              wrapper.appendChild(dom);
              html += wrapper.innerHTML;
            }
          });
          return html;
        },
      };
    }
  }, [editor, editorRef]);

  // Track table position for button placement
  useEffect(() => {
    const updateTablePosition = () => {
      if (!editorWrapperRef.current) return;
      const table = editorWrapperRef.current.querySelector('.tableWrapper');
      if (table) {
        const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
        const tableRectData = table.getBoundingClientRect();
        setTableRect({
          top: tableRectData.top - wrapperRect.top,
          bottom: wrapperRect.bottom - tableRectData.bottom,
          left: tableRectData.left - wrapperRect.left,
          right: wrapperRect.right - tableRectData.right,
        });
      } else {
        setTableRect(null);
      }
    };

    updateTablePosition();
    const interval = setInterval(updateTablePosition, 100);
    return () => clearInterval(interval);
  }, [editor]);

  useEffect(() => {
    if (showPageLinkDialog) {
      loadPagesAndCategories();
    }
  }, [showPageLinkDialog]);

  useEffect(() => {
    if (selectedCategory) {
      setFilteredPages(pages.filter(p => p.category === selectedCategory));
    } else {
      setFilteredPages(pages);
    }
  }, [selectedCategory, pages]);

  // Close color/highlight pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorButtonRef.current && !colorButtonRef.current.contains(event.target as Node)) {
        const picker = colorButtonRef.current.parentElement?.querySelector('.absolute');
        if (picker && !picker.contains(event.target as Node)) {
          setShowColorPicker(false);
        }
      }
      if (highlightButtonRef.current && !highlightButtonRef.current.contains(event.target as Node)) {
        const picker = highlightButtonRef.current.parentElement?.querySelector('.absolute');
        if (picker && !picker.contains(event.target as Node)) {
          setShowHighlightPicker(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPagesAndCategories = async () => {
    try {
      // Load categories
      const catResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (catResponse.ok) {
        const catData = await catResponse.json();
        setCategories(catData.categories || []);
      }

      // Load pages
      const pagesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json();
        setPages(pagesData.pages || []);
      }
    } catch (err) {
      console.error('Error loading pages:', err);
    }
  };

  if (!editor) {
    return null;
  }

  const searchImage = async () => {
    if (!imageSearch) return;
    
    setLoadingImage(true);
    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(imageSearch)}&per_page=1&client_id=demo`);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setImageUrl(data.results[0].urls.regular);
      }
    } catch (err) {
      console.error('Error searching image:', err);
    } finally {
      setLoadingImage(false);
    }
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setImageSearch('');
      setShowImageDialog(false);
    }
  };

  const getEmbedUrl = (url: string, provider: 'youtube' | 'loom' | 'vimeo'): string | null => {
    try {
      if (provider === 'youtube') {
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(youtubeRegex);
        if (match && match[1]) {
          return `https://www.youtube.com/embed/${match[1]}`;
        }
      } else if (provider === 'loom') {
        const loomRegex = /loom\.com\/share\/([a-zA-Z0-9]+)/;
        const match = url.match(loomRegex);
        if (match && match[1]) {
          return `https://www.loom.com/embed/${match[1]}`;
        }
      } else if (provider === 'vimeo') {
        const vimeoRegex = /vimeo\.com\/(\d+)/;
        const match = url.match(vimeoRegex);
        if (match && match[1]) {
          return `https://player.vimeo.com/video/${match[1]}`;
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  const addVideo = () => {
    if (videoUrl) {
      const embedUrl = getEmbedUrl(videoUrl, videoProvider);
      if (embedUrl) {
        editor.chain().focus().insertContent({
          type: 'videoEmbed',
          attrs: { src: embedUrl, provider: videoProvider },
        }).run();
        setVideoUrl('');
        setShowVideoDialog(false);
      } else {
        alert(`Neplatná ${videoProvider === 'youtube' ? 'YouTube' : videoProvider === 'loom' ? 'Loom' : 'Vimeo'} URL. Zkuste to znovu.`);
      }
    }
  };

  const addEmbed = () => {
    if (embedUrl) {
      editor.chain().focus().insertContent({
        type: 'iframeEmbed',
        attrs: { src: embedUrl, height: embedHeight },
      }).run();
      setEmbedUrl('');
      setEmbedHeight('400');
      setShowEmbedDialog(false);
    }
  };

  const addLink = () => {
    if (linkUrl && linkTitle) {
      editor.chain().focus().insertContent({
        type: 'externalLinkBadge',
        attrs: { href: linkUrl, title: linkTitle },
      }).run();
      setLinkUrl('');
      setLinkTitle('');
      setShowLinkDialog(false);
    }
  };

  const addPageLink = () => {
    const page = pages.find(p => p.id === selectedPage);
    if (page) {
      editor.chain().focus().insertContent({
        type: 'pageLink',
        attrs: { 
          category: page.category, 
          slug: page.slug, 
          title: page.title 
        },
      }).run();
      setSelectedPage('');
      setSelectedCategory('');
      setShowPageLinkDialog(false);
    }
  };

  const insertCallout = (type: 'info' | 'warning' | 'tip' | 'danger' | 'summary' | 'methodology') => {
    const titles = {
      info: 'Informace',
      warning: 'Upozornění',
      tip: 'Tip',
      danger: 'Varování',
      summary: 'Shrnutí',
      methodology: 'Metodická inspirace'
    };
    
    // Use saved selection if available (from dropdown), otherwise use current selection
    const selection = savedSelection || { from: editor.state.selection.from, to: editor.state.selection.to };
    const { from, to } = selection;
    const empty = from === to;
    
    if (!empty) {
      // First restore selection
      editor.chain().focus().setTextSelection({ from, to }).run();
      
      // Get selected content as JSON (preserves formatting like headings)
      const slice = editor.state.doc.slice(from, to);
      const contentJson = slice.content.toJSON();
      
      // Ensure content is wrapped in block nodes (callout requires block+ content)
      const blockTypes = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'callout'];
      
      const ensureBlockContent = (content: any[]): any[] => {
        return content.map(node => {
          // If it's already a block type, return as-is
          if (blockTypes.includes(node.type)) {
            return node;
          }
          // If it's inline content (text, etc.), wrap in paragraph
          return {
            type: 'paragraph',
            content: [node]
          };
        });
      };
      
      const contentArray = Array.isArray(contentJson) ? contentJson : [contentJson];
      const blockContent = ensureBlockContent(contentArray);
      
      // Build callout with preserved content (NodeView handles title display)
      const calloutNode = {
        type: 'callout',
        attrs: { type, title: titles[type] },
        content: blockContent
      };
      
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent(calloutNode)
        .run();
    } else {
      // No selection - insert empty callout (NodeView handles title display)
      const defaultContent = [{ type: 'paragraph', content: [{ type: 'text', text: 'Vložte text zde...' }] }];
      
      editor
        .chain()
        .focus()
        .insertContent({
        type: 'callout',
        attrs: { type, title: titles[type] },
          content: defaultContent
        })
        .run();
    }
    
    // Clear saved selection after use
    setSavedSelection(null);
  };

  // State for text style dropdown
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);

  const getCurrentStyle = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Nadpis 1';
    if (editor.isActive('heading', { level: 2 })) return 'Nadpis 2';
    if (editor.isActive('heading', { level: 3 })) return 'Nadpis 3';
    return 'Text';
  };

  const setTextStyle = (style: string) => {
    switch (style) {
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      default:
        editor.chain().focus().setParagraph().run();
    }
    setStyleDropdownOpen(false);
  };

  const updateImageSize = (percentage: number) => {
    if (editor.isActive('image')) {
      editor.chain().focus().updateAttributes('image', {
        style: `width: ${percentage}%; height: auto;`
      }).run();
    }
  };

  const updateImageAlignment = (align: 'left' | 'center' | 'right') => {
    if (editor.isActive('image')) {
      let style = 'display: block;';
      if (align === 'center') {
        style += 'margin-left: auto; margin-right: auto;';
      } else if (align === 'right') {
        style += 'margin-left: auto; margin-right: 0;';
      } else {
        style += 'margin-right: auto; margin-left: 0;';
      }
      
      // Keep existing width if present
      const currentAttrs = editor.getAttributes('image');
      const currentStyle = currentAttrs.style || '';
      const widthMatch = currentStyle.match(/width:\s*[^;]+;/);
      if (widthMatch) {
        style += widthMatch[0];
      } else {
        style += 'width: 100%;'; // Default to 100% if no width set
      }

      editor.chain().focus().updateAttributes('image', {
        style: style
      }).run();
    }
  };

  return (
    <div className="rich-text-editor border-0 relative">
      {/* ResizableImageComponent handles its own controls now, so BubbleMenu for images is redundant and removed to avoid conflict */}
      
      {/* Single Row Toolbar - Sticky when scrolling, fixed sizing */}
      <div 
        className="sticky top-0 z-50 flex items-center rounded-t-[11px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex-wrap"
        style={{ 
          backgroundColor: '#EFF1F8',
          padding: '10px 12px',
          gap: '4px'
        }}
      >
        {/* Text Style Dropdown - Functional */}
        <div className="relative flex-shrink-0" style={{ overflow: 'visible' }}>
        <button
            onClick={() => setStyleDropdownOpen(!styleDropdownOpen)}
            className="flex items-center text-slate-700 bg-white/50 hover:bg-white rounded-lg transition-colors border border-slate-200"
            style={{ 
              padding: '5px 10px',
              gap: '4px',
              fontSize: '13px'
            }}
          >
            <span className="font-medium" style={{ minWidth: '52px' }}>{getCurrentStyle()}</span>
            <ChevronDown style={{ width: '14px', height: '14px' }} className="opacity-60" />
        </button>
          
          {styleDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0" 
                  style={{ zIndex: 9998 }}
                  onClick={() => setStyleDropdownOpen(false)}
                />
                <div 
                  className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[140px]"
                  style={{ zIndex: 9999 }}
                >
        <button
                  onClick={() => setTextStyle('normal')}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${!editor.isActive('heading') ? 'bg-slate-50 font-medium' : ''}`}
        >
                  Text
        </button>
        <button
                  onClick={() => setTextStyle('h1')}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-50 font-medium' : ''}`}
        >
                  Nadpis 1
        </button>
        <button
                  onClick={() => setTextStyle('h2')}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-50 font-medium' : ''}`}
        >
                  Nadpis 2
        </button>
        <button
                  onClick={() => setTextStyle('h3')}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${editor.isActive('heading', { level: 3 }) ? 'bg-slate-50 font-medium' : ''}`}
        >
                  Nadpis 3
        </button>
              </div>
            </>
          )}
        </div>

        {/* Font Size Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md hover:bg-white/60 transition-colors flex-shrink-0 flex items-center gap-1 px-2"
              style={{ padding: '6px 8px' }}
              title="Velikost písma"
            >
              <span className="text-slate-600 text-sm font-medium" style={{ minWidth: '28px' }}>
                {(() => {
                  const marks = editor.state.selection.$from.marks();
                  const textStyle = marks.find((m: any) => m.type.name === 'textStyle');
                  const fontSize = textStyle?.attrs?.fontSize;
                  if (fontSize) {
                    return fontSize.replace('px', '');
                  }
                  return '16';
                })()}
              </span>
              <ChevronDown className="text-slate-400" style={{ width: '12px', height: '12px' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[80px] py-1 max-h-[300px] overflow-y-auto">
            {[10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72].map(size => (
              <DropdownMenuItem 
                key={size}
                onSelect={() => {
                  editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
                }}
                className="cursor-pointer py-1.5 justify-center"
              >
                <span>{size}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="bg-slate-300 flex-shrink-0" style={{ width: '1px', height: '18px', margin: '0 3px' }} />
        
        {/* Text Formatting - fixed sizing */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded-md hover:bg-white/60 transition-colors flex-shrink-0 ${editor.isActive('bold') ? 'bg-white shadow-sm' : ''}`}
          style={{ padding: '7px' }}
          title="Tučné (Ctrl+B)"
        >
          <Bold className="text-slate-700" style={{ width: '21px', height: '21px' }} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded-md hover:bg-white/60 transition-colors flex-shrink-0 ${editor.isActive('italic') ? 'bg-white shadow-sm' : ''}`}
          style={{ padding: '7px' }}
          title="Kurzíva (Ctrl+I)"
        >
          <Italic className="text-slate-700" style={{ width: '21px', height: '21px' }} />
        </button>
        <button
          onClick={() => (editor.commands as any).toggleUnderline()}
          className={`rounded-md hover:bg-white/60 transition-colors flex-shrink-0 ${editor.isActive('underline') ? 'bg-white shadow-sm' : ''}`}
          style={{ padding: '7px' }}
          title="Podtržené (Ctrl+U)"
        >
          <svg className="text-slate-700" style={{ width: '21px', height: '21px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4v6a6 6 0 0 0 12 0V4"/>
            <line x1="4" y1="20" x2="20" y2="20"/>
          </svg>
        </button>
        
        <div className="bg-slate-300 flex-shrink-0" style={{ width: '1px', height: '18px', margin: '0 3px' }} />

        {/* Combined Color Picker Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
          <button 
              className="rounded-md hover:bg-white/60 transition-colors flex-shrink-0 flex items-center gap-1"
              style={{ padding: '6px 8px' }}
              title="Barvy"
          >
              <div 
                className="relative flex items-center justify-center"
                style={{ 
                  width: '24px', 
                  height: '24px',
                  backgroundColor: (() => {
                    const marks = editor.state.selection.$from.marks();
                    const highlight = marks.find((m: any) => m.type.name === 'highlight');
                    return highlight?.attrs?.color || '#fef08a';
                  })(),
                  borderRadius: '4px'
                }}
              >
                <span 
                  className="font-bold"
                  style={{ 
                    fontSize: '14px',
                    color: (() => {
                      const marks = editor.state.selection.$from.marks();
                      const textStyle = marks.find((m: any) => m.type.name === 'textStyle');
                      return textStyle?.attrs?.color || '#374151';
                    })()
                  }}
                >
                  A
                </span>
                <div 
                  className="absolute bottom-0 left-1 right-1"
                  style={{ 
                    height: '3px',
                    borderRadius: '1px',
                    backgroundColor: (() => {
                      const marks = editor.state.selection.$from.marks();
                      const textStyle = marks.find((m: any) => m.type.name === 'textStyle');
                      return textStyle?.attrs?.color || '#dc2626';
                    })()
                  }}
                />
              </div>
              <ChevronDown className="text-slate-400" style={{ width: '12px', height: '12px' }} />
          </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-4" style={{ minWidth: '240px' }} onCloseAutoFocus={(e) => e.preventDefault()}>
            {/* Text Color Section */}
            <p className="text-sm font-medium text-slate-700 mb-3">Barva textu</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[
                { color: '#000000', label: 'Černá' },
                { color: '#6b7280', label: 'Šedá' },
                { color: '#dc2626', label: 'Červená' },
                { color: '#ea580c', label: 'Oranžová' },
                { color: '#ca8a04', label: 'Žlutá' },
                { color: '#16a34a', label: 'Zelená' },
                { color: '#0891b2', label: 'Tyrkysová' },
                { color: '#2563eb', label: 'Modrá' },
                { color: '#7c3aed', label: 'Fialová' },
                { color: '#db2777', label: 'Růžová' },
              ].map(({ color, label }) => (
                  <button
                    key={color}
                    type="button"
                  className="hover:scale-110 transition-transform cursor-pointer"
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%',
                    backgroundColor: `${color}15`,
                    border: '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                    onClick={() => {
                      editor.chain().focus().setMark('textStyle', { color }).run();
                    }}
                  title={label}
                >
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color }}>A</span>
              </button>
              ))}
        </div>
        
            {/* Highlight Color Section */}
            <p className="text-sm font-medium text-slate-700 mb-3">Zvýraznění</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {[
                { color: 'transparent', label: 'Žádné' },
                { color: '#f3f4f6', label: 'Šedá' },
                { color: '#fef3c7', label: 'Béžová' },
                { color: '#fde68a', label: 'Žlutá' },
                { color: '#fef08a', label: 'Světle žlutá' },
                { color: '#bbf7d0', label: 'Zelená' },
                { color: '#bfdbfe', label: 'Modrá' },
                { color: '#c4b5fd', label: 'Fialová' },
                { color: '#fbcfe8', label: 'Růžová' },
                { color: '#fecaca', label: 'Červená' },
              ].map(({ color, label }) => (
                  <button
                    key={color}
                    type="button"
                  className="hover:scale-110 transition-transform cursor-pointer"
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%',
                    backgroundColor: color === 'transparent' ? 'white' : color,
                    border: color === 'transparent' ? '2px solid #e2e8f0' : '2px solid transparent'
                  }}
                    onClick={() => {
                    if (color === 'transparent') {
                      editor.chain().focus().unsetMark('highlight').run();
                    } else {
                      editor.chain().focus().setMark('highlight', { color }).run();
                    }
                    }}
                  title={label}
                  />
                ))}
              </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="bg-slate-300 flex-shrink-0" style={{ width: '1px', height: '18px', margin: '0 3px' }} />

        {/* Lists Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
        <button
              className={`rounded-md hover:bg-white/60 transition-colors flex-shrink-0 flex items-center gap-1 ${
                editor.isActive('orderedList') || editor.isActive('bulletList') || editor.isActive('taskList') ? 'bg-white shadow-sm' : ''
              }`}
              style={{ padding: '6px 8px' }}
              title="Seznamy"
        >
              {editor.isActive('orderedList') ? (
                <ListOrdered className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              ) : editor.isActive('taskList') ? (
                <ListChecks className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              ) : (
                <List className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              )}
              <ChevronDown className="text-slate-400" style={{ width: '12px', height: '12px' }} />
        </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px] py-1">
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().toggleOrderedList().run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive('orderedList') ? 'bg-slate-100' : ''}`}
            >
              <ListOrdered className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Číslovaný seznam</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().toggleBulletList().run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive('bulletList') ? 'bg-slate-100' : ''}`}
            >
              <List className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Odrážky</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().toggleTaskList().run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive('taskList') ? 'bg-slate-100' : ''}`}
        >
              <ListChecks className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Checklist</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Math Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
        <button
              className={`rounded-md hover:bg-white/60 transition-colors flex-shrink-0 flex items-center gap-1 ${
                editor.isActive('subscript') || editor.isActive('superscript') ? 'bg-white shadow-sm' : ''
              }`}
              style={{ padding: '6px 8px' }}
              title="Matematika"
            >
              <Sigma className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              <ChevronDown className="text-slate-400" style={{ width: '12px', height: '12px' }} />
        </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px] py-1">
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().toggleSuperscript().run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive('superscript') ? 'bg-slate-100' : ''}`}
            >
              <SuperscriptIcon className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Horní index</span>
              <span className="ml-auto text-xs text-slate-400">x²</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().toggleSubscript().run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive('subscript') ? 'bg-slate-100' : ''}`}
            >
              <SubscriptIcon className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Dolní index</span>
              <span className="ml-auto text-xs text-slate-400">H₂O</span>
            </DropdownMenuItem>
<DropdownMenuItem
              onSelect={() => {
                setLatexInput('');
                setShowLatexDialog(true);
              }}
              className="flex items-center gap-3 cursor-pointer py-2"
            >
              <span className="text-slate-600 font-serif italic" style={{ width: '16px', fontSize: '14px' }}>∑</span>
              <span>LaTeX vzorec</span>
              <span className="ml-auto text-xs text-slate-400">∫ ∑ √</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="bg-slate-300 flex-shrink-0" style={{ width: '1px', height: '18px', margin: '0 3px' }} />

        {/* Text Alignment Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md hover:bg-white/60 transition-colors flex-shrink-0 flex items-center gap-1"
              style={{ padding: '6px 8px' }}
              title="Zarovnání textu"
            >
              {editor.isActive({ textAlign: 'center' }) ? (
                <AlignCenter className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              ) : editor.isActive({ textAlign: 'right' }) ? (
                <AlignRight className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              ) : editor.isActive({ textAlign: 'justify' }) ? (
                <AlignJustify className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              ) : (
                <AlignLeft className="text-slate-700" style={{ width: '18px', height: '18px' }} />
              )}
              <ChevronDown className="text-slate-400" style={{ width: '12px', height: '12px' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px] py-1">
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().setTextAlign('left').run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-100' : ''}`}
            >
              <AlignLeft className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Doleva</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().setTextAlign('center').run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-100' : ''}`}
            >
              <AlignCenter className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Na střed</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().setTextAlign('right').run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-100' : ''}`}
            >
              <AlignRight className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Doprava</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`flex items-center gap-3 cursor-pointer py-2 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-slate-100' : ''}`}
            >
              <AlignJustify className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Do bloku</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown menus */}
        <div className="flex items-center flex-wrap" style={{ gap: '4px', marginLeft: '3px' }}>
          <div className="bg-slate-300 flex-shrink-0" style={{ width: '1px', height: '18px', margin: '0 3px' }} />
          
        {/* Přidat Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md hover:bg-white/60 transition-colors flex-shrink-0 flex items-center gap-1.5 px-2"
              style={{ padding: '6px 10px' }}
              title="Přidat"
              onMouseDown={() => {
                // Save selection BEFORE dropdown steals focus
                if (editor) {
                  setSavedSelection({
                    from: editor.state.selection.from,
                    to: editor.state.selection.to
                  });
                }
              }}
            >
              <span className="text-slate-600 text-sm font-medium">Přidat</span>
              <ChevronDown className="text-slate-400" style={{ width: '14px', height: '14px' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px] py-2">
            <DropdownMenuItem 
              onSelect={() => setShowImageDialog(true)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <ImageIcon className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Obrázek</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => setShowVideoDialog(true)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <Video className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Video</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => setShowLinkDialog(true)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <LinkIcon className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Odkaz</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => setShowEmbedDialog(true)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <Code2 className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Embed</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => setShowPageLinkDialog(true)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <FileText className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Odkaz na dokument</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setShowTableDialog(true)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <TableIcon className="text-slate-600" style={{ width: '16px', height: '16px' }} />
              <span>Tabulka</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Infobox Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md hover:bg-white/60 transition-colors flex-shrink-0 flex items-center gap-1.5 px-2"
              style={{ padding: '6px 10px' }}
              title="Infobox"
              onMouseDown={() => {
                // Save selection BEFORE dropdown steals focus
                if (editor) {
                  setSavedSelection({
                    from: editor.state.selection.from,
                    to: editor.state.selection.to
                  });
                }
              }}
            >
              <Info className="text-blue-500" style={{ width: '21px', height: '21px' }} />
              <span className="text-slate-600 text-sm font-medium">Infobox</span>
              <ChevronDown className="text-slate-400" style={{ width: '14px', height: '14px' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px] py-2">
            <DropdownMenuItem 
              onSelect={() => insertCallout('info')}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <Info className="text-blue-500" style={{ width: '16px', height: '16px' }} />
              <span>Info box</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => insertCallout('tip')}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <Lightbulb className="text-green-500" style={{ width: '16px', height: '16px' }} />
              <span>Tip</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => insertCallout('warning')}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <AlertTriangle className="text-amber-500" style={{ width: '16px', height: '16px' }} />
              <span>Upozornění</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => insertCallout('summary')}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <BookOpen className="text-indigo-500" style={{ width: '16px', height: '16px' }} />
              <span>Shrnutí</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => insertCallout('methodology')}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <GraduationCap className="text-purple-500" style={{ width: '16px', height: '16px' }} />
              <span>Metodická inspirace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

        {/* Hidden undo/redo buttons for external control */}
        <button
          data-undo-btn
          onClick={() => editor.chain().focus().undo().run()}
          className="hidden"
        />
        <button
          data-redo-btn
          onClick={() => editor.chain().focus().redo().run()}
          className="hidden"
        />
      </div>

        {/* Editor Content - White background */}
        <div 
          className="bg-white mx-3 mb-3 overflow-hidden cursor-text relative"
          style={{ borderRadius: '18px', padding: '60px' }}
          onClick={() => editor?.chain().focus().run()}
        >
          {/* Placeholder overlay for empty editor */}
          {editor && editor.isEmpty && (
            <div 
              className="absolute pointer-events-none text-gray-400"
              style={{ top: '60px', left: '60px' }}
            >
              Začněte psát...
            </div>
          )}

      {/* Editor Content with table buttons overlay */}
      <div className="relative" ref={editorWrapperRef}>
      <EditorContent editor={editor} />
        
        {/* Table control buttons - positioned dynamically */}
        {editor && editor.isActive('table') && tableRect && (
          <>
            {/* TOP row: Style dropdown, Add Row, Delete dropdown */}
            <div 
              className="flex justify-between items-center px-0"
              style={{ 
                position: 'absolute',
                top: tableRect.top - 40, 
                left: 0,
                right: 0,
                zIndex: 9999,
                pointerEvents: 'none'
              }}
            >
              {/* Style dropdown */}
              <div className="relative" style={{ pointerEvents: 'auto' }}>
                <details className="table-dropdown">
                  <summary className="table-dropdown-btn">
                    <span>Styl</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="table-dropdown-menu" style={{ minWidth: '200px' }}>
                    <div className="table-dropdown-section-title">Barvy</div>
                    <div className="table-color-grid">
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#f1f5f9');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#94a3b8');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#f1f5f9', borderColor: '#94a3b8' }}
                        title="Základní"
                      />
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#dbeafe');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#3b82f6');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#dbeafe', borderColor: '#3b82f6' }}
                        title="Modrá"
                      />
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#dcfce7');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#22c55e');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#dcfce7', borderColor: '#22c55e' }}
                        title="Zelená"
                      />
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#f3e8ff');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#a855f7');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#f3e8ff', borderColor: '#a855f7' }}
                        title="Fialová"
                      />
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#fef3c7');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#f59e0b');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#fef3c7', borderColor: '#f59e0b' }}
                        title="Žlutá"
                      />
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#fee2e2');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#ef4444');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#fee2e2', borderColor: '#ef4444' }}
                        title="Červená"
                      />
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#fce7f3');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#ec4899');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#fce7f3', borderColor: '#ec4899' }}
                        title="Růžová"
                      />
                      <button
                        onClick={() => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            table.style.setProperty('--table-header-bg', '#cffafe');
                            table.style.setProperty('--table-cell-bg', '#ffffff');
                            table.style.setProperty('--table-border-color', '#06b6d4');
                          }
                        }}
                        className="table-color-btn"
                        style={{ background: '#cffafe', borderColor: '#06b6d4' }}
                        title="Tyrkysová"
                      />
                    </div>
                    
                    <div className="table-dropdown-divider" />
                    <div className="table-dropdown-section-title">Nastavení</div>
                    
                    <label className="table-dropdown-checkbox">
                      <input
                        type="checkbox"
                        checked={editor.isActive('tableHeader')}
                        onChange={() => editor.chain().focus().toggleHeaderRow().run()}
                      />
                      <span>Záhlaví</span>
                    </label>
                    
                    <label className="table-dropdown-checkbox">
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        onChange={(e) => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            if (e.target.checked) {
                              table.classList.remove('no-border');
                            } else {
                              table.classList.add('no-border');
                            }
                          }
                        }}
                      />
                      <span>Ohraničení</span>
                    </label>
                    
                    <label className="table-dropdown-checkbox">
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        onChange={(e) => {
                          const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                          if (table) {
                            if (e.target.checked) {
                              table.classList.remove('no-rounded');
                            } else {
                              table.classList.add('no-rounded');
                            }
                          }
                        }}
                      />
                      <span>Zaoblené rohy</span>
                    </label>
                  </div>
                </details>
              </div>
              
              {/* Add Row button */}
              <button
                onClick={() => editor.chain().focus().addRowBefore().run()}
                className="table-add-btn table-add-btn-blue"
                style={{ pointerEvents: 'auto' }}
                title="Přidat řádek nahoře"
              >
                <Plus size={16} />
                <span className="table-add-btn-text">Přidat řádek</span>
              </button>
              
              {/* Delete dropdown */}
              <div className="relative" style={{ pointerEvents: 'auto' }}>
                <details className="table-dropdown">
                  <summary className="table-dropdown-btn table-dropdown-btn-danger">
                    <span>Smazat</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="table-dropdown-menu table-dropdown-menu-right">
                    <button
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      className="table-dropdown-item table-dropdown-item-danger"
                    >
                      Smazat řádek
                    </button>
                    <button
                      onClick={() => editor.chain().focus().deleteColumn().run()}
                      className="table-dropdown-item table-dropdown-item-danger"
                    >
                      Smazat sloupec
                    </button>
                    <div className="table-dropdown-divider" />
                    <button
                      onClick={() => editor.chain().focus().deleteTable().run()}
                      className="table-dropdown-item table-dropdown-item-danger-strong"
                    >
                      Smazat celou tabulku
                    </button>
                  </div>
                </details>
              </div>
            </div>
            
            {/* Resize handle - on the bottom edge of table */}
            <div 
              className="flex justify-center"
              style={{ 
                position: 'absolute',
                top: `calc(100% - ${tableRect.bottom}px - 8px)`, 
                left: 0,
                right: 0,
                zIndex: 10000,
                pointerEvents: 'none'
              }}
            >
              <div
                className="table-resize-handle"
                style={{ pointerEvents: 'auto' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const table = document.querySelector('.tiptap-editor table') as HTMLElement;
                  if (!table) return;
                  
                  const startY = e.clientY;
                  const startHeight = table.offsetHeight;
                  
                  const onMouseMove = (moveEvent: MouseEvent) => {
                    const deltaY = moveEvent.clientY - startY;
                    const newHeight = Math.max(100, startHeight + deltaY);
                    table.style.height = `${newHeight}px`;
                  };
                  
                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };
                  
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
                title="Táhněte pro změnu výšky"
              />
            </div>
            
            {/* BOTTOM row: Add Column Left, Add Row, Add Column Right */}
            <div 
              className="flex justify-between items-center"
              style={{ 
                position: 'absolute',
                top: `calc(100% - ${tableRect.bottom}px + 12px)`, 
                left: 0,
                right: 0,
                zIndex: 9999,
                pointerEvents: 'none'
              }}
            >
              <button
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                className="table-add-btn table-add-btn-green"
                style={{ pointerEvents: 'auto' }}
                title="Přidat sloupec vlevo"
              >
                <Plus size={16} />
                <span className="table-add-btn-text">Přidat sloupec</span>
              </button>
              
              <button
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="table-add-btn table-add-btn-blue"
                style={{ pointerEvents: 'auto' }}
                title="Přidat řádek dole"
              >
                <Plus size={16} />
                <span className="table-add-btn-text">Přidat řádek</span>
              </button>
              
              <button
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="table-add-btn table-add-btn-green"
                style={{ pointerEvents: 'auto' }}
                title="Přidat sloupec vpravo"
              >
                <Plus size={16} />
                <span className="table-add-btn-text">Přidat sloupec</span>
              </button>
            </div>
          </>
        )}
      </div>
        </div>

      {/* Image Dialog */}
      {showImageDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowImageDialog(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Vložit obrázek</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm">Vyhledat obrázek</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageSearch}
                    onChange={(e) => setImageSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchImage()}
                    placeholder="Např: moře, příroda, technologie..."
                    className="flex-1 px-3 py-2 bg-input-background border border-border rounded"
                  />
                  <button
                    onClick={searchImage}
                    disabled={loadingImage}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                  >
                    {loadingImage ? 'Hledám...' : 'Hledat'}
                  </button>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-x-0 flex items-center">
                  <div className="flex-1 border-t border-border"></div>
                  <span className="px-3 text-sm text-muted-foreground">nebo</span>
                  <div className="flex-1 border-t border-border"></div>
                </div>
              </div>
              
              <div>
                <label className="block mb-2 text-sm">URL obrázku</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addImage()}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded"
                />
              </div>
              
              {imageUrl && (
                <div className="border border-border rounded p-2">
                  <img src={imageUrl} alt="Náhled" className="max-h-40 mx-auto" />
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={addImage}
                disabled={!imageUrl}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                Vložit
              </button>
              <button
                onClick={() => {
                  setShowImageDialog(false);
                  setImageUrl('');
                  setImageSearch('');
                }}
                className="flex-1 px-4 py-2 border border-border rounded hover:bg-accent"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Dialog */}
      {showVideoDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowVideoDialog(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Vložit video</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm">Platforma</label>
                <select
                  value={videoProvider}
                  onChange={(e) => setVideoProvider(e.target.value as 'youtube' | 'loom' | 'vimeo')}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded"
                >
                  <option value="youtube">YouTube</option>
                  <option value="loom">Loom</option>
                  <option value="vimeo">Vimeo</option>
                </select>
              </div>
              
              <div>
                <label className="block mb-2 text-sm">URL videa</label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addVideo()}
                  placeholder={
                    videoProvider === 'youtube' ? 'https://youtube.com/watch?v=...' :
                    videoProvider === 'loom' ? 'https://loom.com/share/...' :
                    'https://vimeo.com/...'
                  }
                  className="w-full px-3 py-2 bg-input-background border border-border rounded"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={addVideo}
                disabled={!videoUrl}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                Vložit
              </button>
              <button
                onClick={() => {
                  setShowVideoDialog(false);
                  setVideoUrl('');
                }}
                className="flex-1 px-4 py-2 border border-border rounded hover:bg-accent"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embed Dialog (CodePen, JSFiddle, etc.) */}
      {showEmbedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEmbedDialog(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Vložit embed</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm">URL nebo embed kód</label>
                <textarea
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://codepen.io/... nebo <iframe>...</iframe>"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded h-24 resize-none"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Podporováno: CodePen, JSFiddle, nebo iframe
                </p>
              </div>
              
              <div>
                <label className="block mb-2 text-sm">Výška (px)</label>
                <input
                  type="number"
                  value={embedHeight}
                  onChange={(e) => setEmbedHeight(e.target.value)}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={addEmbed}
                disabled={!embedUrl}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                Vložit
              </button>
              <button
                onClick={() => {
                  setShowEmbedDialog(false);
                  setEmbedUrl('');
                  setEmbedHeight('400');
                }}
                className="flex-1 px-4 py-2 border border-border rounded hover:bg-accent"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Link Dialog */}
      {/* Document Link Picker - New Component */}
      <DocumentLinkPicker
        isOpen={showPageLinkDialog}
        onClose={() => {
          setShowPageLinkDialog(false);
          setSelectedPage('');
          setSelectedCategory('');
        }}
        onSelect={(item) => {
          if (item.type === 'mycontent') {
            // Insert link to my content document
            editor.chain().focus().insertContent({
              type: 'pageLink',
              attrs: { 
                category: 'my-content', 
                slug: item.slug, 
                title: item.title 
              },
            }).run();
          } else {
            // Insert link to Vividbooks page
            editor.chain().focus().insertContent({
              type: 'pageLink',
              attrs: { 
                category: item.category, 
                slug: item.slug, 
                title: item.title 
              },
            }).run();
          }
          setShowPageLinkDialog(false);
          setSelectedPage('');
          setSelectedCategory('');
        }}
      />

{/* Table Dialog */}
      {showTableDialog && (
        <CreateTableDialog
          onCreateTable={(rows, cols, hasHeader) => {
            editor.chain().focus().insertTable({
              rows,
              cols,
              withHeaderRow: hasHeader
            }).run();
          }}
          onClose={() => setShowTableDialog(false)}
        />
      )}

      {/* LaTeX Dialog */}
      {showLatexDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLatexDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">∑</span>
                Vložit LaTeX vzorec
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Zadejte LaTeX vzorec:
                </label>
                <input
                  type="text"
                  value={latexInput}
                  onChange={e => setLatexInput(e.target.value)}
                  placeholder="např. E = mc^2, \frac{a}{b}, \sqrt{x}"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && latexInput.trim()) {
                      (editor.commands as any).insertLatex(latexInput.trim());
                      setShowLatexDialog(false);
                      setLatexInput('');
                    }
                  }}
                />
              </div>

              {/* Preview */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Náhled:
                </label>
                <div 
                  className="p-4 bg-slate-50 rounded-lg min-h-[60px] flex items-center justify-center border border-slate-200"
                  ref={el => {
                    if (el && latexInput) {
                      try {
                        katex.render(latexInput, el, { throwOnError: false, displayMode: true });
                      } catch {
                        el.textContent = latexInput || 'Zadejte vzorec...';
                      }
                    } else if (el) {
                      el.textContent = 'Zadejte vzorec...';
                    }
                  }}
                />
              </div>

              {/* Example formulas */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Příklady:
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'E = mc²', value: 'E = mc^2' },
                    { label: 'Zlomek', value: '\\frac{a}{b}' },
                    { label: 'Odmocnina', value: '\\sqrt{x}' },
                    { label: 'Suma', value: '\\sum_{i=1}^{n} x_i' },
                    { label: 'Integrál', value: '\\int_0^1 f(x) dx' },
                    { label: 'Řecká písmena', value: '\\alpha, \\beta, \\gamma' },
                  ].map(example => (
                    <button
                      key={example.value}
                      onClick={() => setLatexInput(example.value)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm text-slate-700 transition-colors"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowLatexDialog(false);
                    setLatexInput('');
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={() => {
                    if (latexInput.trim()) {
                      (editor.commands as any).insertLatex(latexInput.trim());
                      setShowLatexDialog(false);
                      setLatexInput('');
                    }
                  }}
                  disabled={!latexInput.trim()}
                  style={{ 
                    backgroundColor: latexInput.trim() ? '#2563eb' : '#94a3b8',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: latexInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: latexInput.trim() ? 1 : 0.5
                  }}
                >
                  Vložit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* External Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLinkDialog(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Externí odkaz</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm">Název odkazu</label>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Název odkazu"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm">URL</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={addLink}
                disabled={!linkUrl || !linkTitle}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                Vložit
              </button>
              <button
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setLinkTitle('');
                }}
                className="flex-1 px-4 py-2 border border-border rounded hover:bg-accent"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Source Dialog - For AI Detection */}
      {showPasteSourceDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => {}}>
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[90vw] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header with warning icon */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-amber-900">Vkládáte větší množství textu</h3>
                  <p className="text-sm text-amber-700">Detekováno {pendingPasteText.trim().split(/\s+/).length} slov</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-600">
                Uvěďte prosím odkaz, odkud text kopírujete. Jinak máme podezření na kopírování textu nebo použití umělé inteligence.
              </p>
              
              {/* Preview of pasted text */}
              <div className="bg-slate-50 rounded-lg p-3 max-h-24 overflow-y-auto">
                <p className="text-sm text-slate-500 mb-1 font-medium">Náhled vloženého textu:</p>
                <p className="text-sm text-slate-700 line-clamp-3">{pendingPasteText}</p>
              </div>
              
              {/* Source input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Zdroj textu (URL nebo popis)
                </label>
                <input
                  type="text"
                  value={pasteSource}
                  onChange={(e) => setPasteSource(e.target.value)}
                  placeholder="např. https://wikipedia.org/... nebo 'vlastní poznámky'"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              <div className="text-xs text-slate-500">
                💡 Učitel uvidí, zda jste uvedli zdroj u vloženého textu.
              </div>
            </div>
            
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => {
                  // Log the source (can be sent to backend later)
                  console.log('[Paste Detection] Source provided:', pasteSource, 'for text:', pendingPasteText.substring(0, 100));
                  setShowPasteSourceDialog(false);
                  setPendingPasteText('');
                  setPasteSource('');
                }}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
              >
                {pasteSource ? 'Potvrdit se zdrojem' : 'Pokračovat bez zdroje'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
