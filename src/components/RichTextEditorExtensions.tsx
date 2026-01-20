import { Node } from '@tiptap/core';

// Custom callout extension
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout-type') || element.getAttribute('data-type') || 'info',
        renderHTML: attributes => ({ 'data-callout-type': attributes.type }),
      },
      title: {
        default: '',
        parseHTML: element => element.getAttribute('data-callout-title') || element.getAttribute('data-title') || '',
        renderHTML: attributes => ({ 'data-callout-title': attributes.title }),
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
      {
        tag: 'div.callout',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-callout-type'] || 'info';
    return ['div', { 
      'data-type': 'callout',
      'data-callout-type': type,
      'type': type,
      class: `callout callout-${type}`,
      ...HTMLAttributes 
    }, 0];
  },
});

// Custom video embed extension
export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  
  addAttributes() {
    return {
      src: {
        default: null,
      },
      provider: {
        default: 'youtube',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="video-embed"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', { 
      'data-type': 'video-embed',
      'data-provider': HTMLAttributes.provider,
      'data-src': HTMLAttributes.src,
      class: 'video-embed-container',
    }, 0];
  },
});

// Custom iframe embed extension (for CodePen, JSFiddle, etc.)
export const IframeEmbed = Node.create({
  name: 'iframeEmbed',
  group: 'block',
  atom: true,
  
  addAttributes() {
    return {
      src: {
        default: null,
      },
      height: {
        default: '400',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="iframe-embed"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', { 
      'data-type': 'iframe-embed',
      'data-src': HTMLAttributes.src,
      'data-height': HTMLAttributes.height,
      class: 'iframe-embed-container',
    }, 0];
  },
});

// Custom page link extension (internal docs link as badge)
export const PageLink = Node.create({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
  
  addAttributes() {
    return {
      category: {
        default: null,
      },
      slug: {
        default: null,
      },
      title: {
        default: '',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-type="page-link"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', { 
      'data-type': 'page-link',
      'data-category': HTMLAttributes.category,
      'data-slug': HTMLAttributes.slug,
      'data-title': HTMLAttributes.title,
      class: 'page-link-badge',
    }, HTMLAttributes.title || 'Link'];
  },
});

// Custom external link badge
export const ExternalLinkBadge = Node.create({
  name: 'externalLinkBadge',
  group: 'inline',
  inline: true,
  atom: true,
  
  addAttributes() {
    return {
      href: {
        default: null,
      },
      title: {
        default: '',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-type="external-link"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', { 
      'data-type': 'external-link',
      'data-href': HTMLAttributes.href,
      'data-title': HTMLAttributes.title,
      class: 'external-link-badge',
    }, HTMLAttributes.title || 'External Link'];
  },
});
