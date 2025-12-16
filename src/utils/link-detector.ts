/**
 * Link Detector - detekuje typ odkazu a vrací odpovídající metadata
 */

export interface LinkInfo {
  type: LinkType;
  name: string;
  icon: string; // Lucide icon name or custom
  color: string; // Tailwind color class
  bgColor: string; // Background color class
  domain: string;
}

export type LinkType = 
  | 'youtube'
  | 'google-drive'
  | 'google-docs'
  | 'google-sheets'
  | 'google-slides'
  | 'google-forms'
  | 'dropbox'
  | 'onedrive'
  | 'notion'
  | 'figma'
  | 'canva'
  | 'miro'
  | 'trello'
  | 'github'
  | 'gitlab'
  | 'stackoverflow'
  | 'codepen'
  | 'codesandbox'
  | 'spotify'
  | 'soundcloud'
  | 'vimeo'
  | 'twitch'
  | 'tiktok'
  | 'instagram'
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'pinterest'
  | 'reddit'
  | 'discord'
  | 'slack'
  | 'zoom'
  | 'teams'
  | 'meet'
  | 'wikipedia'
  | 'medium'
  | 'substack'
  | 'quizlet'
  | 'kahoot'
  | 'padlet'
  | 'genially'
  | 'prezi'
  | 'loom'
  | 'website';

interface LinkPattern {
  type: LinkType;
  patterns: RegExp[];
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

const LINK_PATTERNS: LinkPattern[] = [
  // Video platformy
  {
    type: 'youtube',
    patterns: [/youtube\.com/, /youtu\.be/],
    name: 'YouTube',
    icon: 'youtube',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    type: 'vimeo',
    patterns: [/vimeo\.com/],
    name: 'Vimeo',
    icon: 'video',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  {
    type: 'twitch',
    patterns: [/twitch\.tv/],
    name: 'Twitch',
    icon: 'twitch',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    type: 'loom',
    patterns: [/loom\.com/],
    name: 'Loom',
    icon: 'video',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    type: 'tiktok',
    patterns: [/tiktok\.com/],
    name: 'TikTok',
    icon: 'music',
    color: 'text-slate-800',
    bgColor: 'bg-slate-100',
  },

  // Google služby
  {
    type: 'google-docs',
    patterns: [/docs\.google\.com\/document/],
    name: 'Google Docs',
    icon: 'file-text',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'google-sheets',
    patterns: [/docs\.google\.com\/spreadsheets/],
    name: 'Google Sheets',
    icon: 'table',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    type: 'google-slides',
    patterns: [/docs\.google\.com\/presentation/],
    name: 'Google Slides',
    icon: 'presentation',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  {
    type: 'google-forms',
    patterns: [/docs\.google\.com\/forms/, /forms\.gle/],
    name: 'Google Forms',
    icon: 'clipboard-list',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    type: 'google-drive',
    patterns: [/drive\.google\.com/],
    name: 'Google Drive',
    icon: 'hard-drive',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    type: 'meet',
    patterns: [/meet\.google\.com/],
    name: 'Google Meet',
    icon: 'video',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },

  // Cloud storage
  {
    type: 'dropbox',
    patterns: [/dropbox\.com/],
    name: 'Dropbox',
    icon: 'cloud',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'onedrive',
    patterns: [/onedrive\.live\.com/, /sharepoint\.com/],
    name: 'OneDrive',
    icon: 'cloud',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
  },

  // Produktivita & Design
  {
    type: 'notion',
    patterns: [/notion\.so/, /notion\.site/],
    name: 'Notion',
    icon: 'book-open',
    color: 'text-slate-800',
    bgColor: 'bg-slate-100',
  },
  {
    type: 'figma',
    patterns: [/figma\.com/],
    name: 'Figma',
    icon: 'figma',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
  },
  {
    type: 'canva',
    patterns: [/canva\.com/],
    name: 'Canva',
    icon: 'palette',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50',
  },
  {
    type: 'miro',
    patterns: [/miro\.com/],
    name: 'Miro',
    icon: 'layout-dashboard',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
  },
  {
    type: 'trello',
    patterns: [/trello\.com/],
    name: 'Trello',
    icon: 'kanban',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },

  // Kód & Dev
  {
    type: 'github',
    patterns: [/github\.com/],
    name: 'GitHub',
    icon: 'github',
    color: 'text-slate-800',
    bgColor: 'bg-slate-100',
  },
  {
    type: 'gitlab',
    patterns: [/gitlab\.com/],
    name: 'GitLab',
    icon: 'gitlab',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    type: 'stackoverflow',
    patterns: [/stackoverflow\.com/],
    name: 'Stack Overflow',
    icon: 'message-square',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
  },
  {
    type: 'codepen',
    patterns: [/codepen\.io/],
    name: 'CodePen',
    icon: 'code',
    color: 'text-slate-800',
    bgColor: 'bg-slate-100',
  },
  {
    type: 'codesandbox',
    patterns: [/codesandbox\.io/],
    name: 'CodeSandbox',
    icon: 'box',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
  },

  // Hudba
  {
    type: 'spotify',
    patterns: [/spotify\.com/, /open\.spotify\.com/],
    name: 'Spotify',
    icon: 'music',
    color: 'text-green-500',
    bgColor: 'bg-green-50',
  },
  {
    type: 'soundcloud',
    patterns: [/soundcloud\.com/],
    name: 'SoundCloud',
    icon: 'cloud',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
  },

  // Sociální sítě
  {
    type: 'instagram',
    patterns: [/instagram\.com/],
    name: 'Instagram',
    icon: 'instagram',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    type: 'twitter',
    patterns: [/twitter\.com/, /x\.com/],
    name: 'X (Twitter)',
    icon: 'twitter',
    color: 'text-slate-800',
    bgColor: 'bg-slate-100',
  },
  {
    type: 'linkedin',
    patterns: [/linkedin\.com/],
    name: 'LinkedIn',
    icon: 'linkedin',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'facebook',
    patterns: [/facebook\.com/, /fb\.com/],
    name: 'Facebook',
    icon: 'facebook',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'pinterest',
    patterns: [/pinterest\.com/],
    name: 'Pinterest',
    icon: 'bookmark',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    type: 'reddit',
    patterns: [/reddit\.com/],
    name: 'Reddit',
    icon: 'message-circle',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },

  // Komunikace
  {
    type: 'discord',
    patterns: [/discord\.com/, /discord\.gg/],
    name: 'Discord',
    icon: 'message-circle',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    type: 'slack',
    patterns: [/slack\.com/],
    name: 'Slack',
    icon: 'hash',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    type: 'zoom',
    patterns: [/zoom\.us/],
    name: 'Zoom',
    icon: 'video',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'teams',
    patterns: [/teams\.microsoft\.com/],
    name: 'Microsoft Teams',
    icon: 'users',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },

  // Vzdělávací platformy
  {
    type: 'quizlet',
    patterns: [/quizlet\.com/],
    name: 'Quizlet',
    icon: 'brain',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    type: 'kahoot',
    patterns: [/kahoot\.com/, /kahoot\.it/],
    name: 'Kahoot!',
    icon: 'gamepad-2',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    type: 'padlet',
    patterns: [/padlet\.com/],
    name: 'Padlet',
    icon: 'sticky-note',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    type: 'genially',
    patterns: [/genial\.ly/, /genially\.com/],
    name: 'Genially',
    icon: 'sparkles',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  {
    type: 'prezi',
    patterns: [/prezi\.com/],
    name: 'Prezi',
    icon: 'presentation',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },

  // Znalostní báze
  {
    type: 'wikipedia',
    patterns: [/wikipedia\.org/],
    name: 'Wikipedia',
    icon: 'book',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
  },
  {
    type: 'medium',
    patterns: [/medium\.com/],
    name: 'Medium',
    icon: 'file-text',
    color: 'text-slate-800',
    bgColor: 'bg-slate-100',
  },
  {
    type: 'substack',
    patterns: [/substack\.com/],
    name: 'Substack',
    icon: 'mail',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
];

/**
 * Detekuje typ odkazu a vrací jeho metadata
 */
export function detectLinkType(url: string): LinkInfo {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');

    for (const pattern of LINK_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(url)) {
          return {
            type: pattern.type,
            name: pattern.name,
            icon: pattern.icon,
            color: pattern.color,
            bgColor: pattern.bgColor,
            domain,
          };
        }
      }
    }

    // Výchozí - obecný web
    return {
      type: 'website',
      name: domain,
      icon: 'globe',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
      domain,
    };
  } catch {
    return {
      type: 'website',
      name: 'Odkaz',
      icon: 'link',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
      domain: 'unknown',
    };
  }
}

/**
 * Extrahuje název z URL (poslední část cesty nebo titulek)
 */
export function extractLinkTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Pro YouTube - extrahuj video ID
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
      return `YouTube Video ${videoId?.slice(0, 8) || ''}`;
    }
    
    // Pro Google Docs - extrahuj název z cesty
    if (urlObj.hostname.includes('docs.google.com')) {
      const pathParts = urlObj.pathname.split('/');
      const docId = pathParts[pathParts.indexOf('d') + 1];
      return `Google Doc ${docId?.slice(0, 8) || ''}`;
    }
    
    // Obecně - použij poslední neprázdnou část cesty
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      // Dekóduj URL a odstraň přípony
      return decodeURIComponent(lastPart.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
    
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Odkaz';
  }
}

/**
 * Validuje URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Metadata z URL
 */
export interface LinkMetadata {
  title: string;
  thumbnailUrl?: string;
  description?: string;
}

/**
 * Extrahuje YouTube video ID z URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    
    // youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Získá thumbnail URL pro YouTube video
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Extrahuje Loom video ID z URL
 */
export function extractLoomVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('loom.com')) {
      const match = urlObj.pathname.match(/\/share\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Získá thumbnail URL pro Loom video
 */
export function getLoomThumbnail(videoId: string): string {
  return `https://cdn.loom.com/sessions/thumbnails/${videoId}-with-play.gif`;
}

/**
 * Načte metadata z URL pomocí různých metod
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  try {
    const urlObj = new URL(url);
    
    // YouTube - použij oEmbed API
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be') {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || 'YouTube Video',
              thumbnailUrl: getYouTubeThumbnail(videoId),
              description: data.author_name ? `od ${data.author_name}` : undefined,
            };
          }
        } catch {
          // Fallback - jen thumbnail
          return {
            title: 'YouTube Video',
            thumbnailUrl: getYouTubeThumbnail(videoId),
          };
        }
      }
    }
    
    // Loom - oEmbed API
    if (urlObj.hostname.includes('loom.com')) {
      const videoId = extractLoomVideoId(url);
      if (videoId) {
        try {
          const oembedUrl = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(url)}`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || 'Loom Video',
              thumbnailUrl: data.thumbnail_url || getLoomThumbnail(videoId),
              description: data.author_name ? `od ${data.author_name}` : undefined,
            };
          }
        } catch {
          // Fallback - jen thumbnail
          return {
            title: 'Loom Video',
            thumbnailUrl: getLoomThumbnail(videoId),
          };
        }
      }
    }
    
    // Vimeo - oEmbed API
    if (urlObj.hostname.includes('vimeo.com')) {
      try {
        const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = await response.json();
          return {
            title: data.title || 'Vimeo Video',
            thumbnailUrl: data.thumbnail_url,
            description: data.author_name ? `od ${data.author_name}` : undefined,
          };
        }
      } catch {
        // Ignore errors
      }
    }
    
    // Pro ostatní služby - použij název z URL nebo detekovaný typ
    return null;
  } catch {
    return null;
  }
}

/**
 * Seznam všech podporovaných služeb pro zobrazení v UI
 */
export const SUPPORTED_SERVICES = [
  { category: 'Video', services: ['YouTube', 'Vimeo', 'Twitch', 'Loom', 'TikTok'] },
  { category: 'Google', services: ['Google Docs', 'Google Sheets', 'Google Slides', 'Google Forms', 'Google Drive', 'Google Meet'] },
  { category: 'Cloud Storage', services: ['Dropbox', 'OneDrive'] },
  { category: 'Produktivita', services: ['Notion', 'Figma', 'Canva', 'Miro', 'Trello', 'Prezi'] },
  { category: 'Kód & Dev', services: ['GitHub', 'GitLab', 'Stack Overflow', 'CodePen', 'CodeSandbox'] },
  { category: 'Hudba', services: ['Spotify', 'SoundCloud'] },
  { category: 'Sociální sítě', services: ['Instagram', 'X (Twitter)', 'LinkedIn', 'Facebook', 'Pinterest', 'Reddit'] },
  { category: 'Komunikace', services: ['Discord', 'Slack', 'Zoom', 'Microsoft Teams'] },
  { category: 'Vzdělávání', services: ['Quizlet', 'Kahoot!', 'Padlet', 'Genially'] },
  { category: 'Znalosti', services: ['Wikipedia', 'Medium', 'Substack'] },
];

