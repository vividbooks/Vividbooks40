/**
 * Image extraction utilities for worksheet generation
 * Extracts images and Lottie animations from HTML content
 */

export interface ExtractedImage {
  url: string;
  alt: string;
  caption?: string;
  type: 'image' | 'lottie';
  // For Lottie: we'll need to generate a static image
  lottieData?: string;
}

/**
 * Extract all images from HTML content
 */
export function extractImagesFromHtml(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  
  if (!html) return images;

  // Extract regular <img> tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    const alt = match[2] || '';
    
    // Skip tiny icons, spacers, or data URIs that are too small
    if (url.includes('spacer') || url.includes('pixel') || url.includes('1x1')) {
      continue;
    }
    
    images.push({
      url,
      alt,
      type: 'image',
    });
  }

  // Also try to find images with alt first: <img alt="..." src="...">
  const imgAltFirstRegex = /<img[^>]+alt=["']([^"']*)["'][^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = imgAltFirstRegex.exec(html)) !== null) {
    const alt = match[1] || '';
    const url = match[2];
    
    // Check if we already have this image
    if (!images.some(img => img.url === url)) {
      images.push({
        url,
        alt,
        type: 'image',
      });
    }
  }

  // Extract figure captions if available
  const figureRegex = /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<figcaption[^>]*>([^<]+)<\/figcaption>[\s\S]*?<\/figure>/gi;
  while ((match = figureRegex.exec(html)) !== null) {
    const url = match[1];
    const caption = match[2]?.trim() || '';
    
    // Update existing image with caption or add new one
    const existingImage = images.find(img => img.url === url);
    if (existingImage) {
      existingImage.caption = caption;
    } else {
      images.push({
        url,
        alt: caption,
        caption,
        type: 'image',
      });
    }
  }

  // Extract Lottie animations
  // Look for lottie-player elements or data attributes
  const lottiePlayerRegex = /<lottie-player[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = lottiePlayerRegex.exec(html)) !== null) {
    const url = match[1];
    if (!images.some(img => img.url === url)) {
      images.push({
        url,
        alt: 'Animace',
        type: 'lottie',
      });
    }
  }

  // Look for custom Lottie components (common in React apps)
  const lottieDataRegex = /data-lottie=["']([^"']+)["']/gi;
  while ((match = lottieDataRegex.exec(html)) !== null) {
    const lottieData = match[1];
    images.push({
      url: '',
      alt: 'Animace',
      type: 'lottie',
      lottieData,
    });
  }

  // Look for LottieSequencePlayer or similar components
  const lottieSequenceRegex = /lottie(?:sequence)?player[^>]+(?:src|animation)=["']([^"']+\.json)["']/gi;
  while ((match = lottieSequenceRegex.exec(html)) !== null) {
    const url = match[1];
    if (!images.some(img => img.url === url)) {
      images.push({
        url,
        alt: 'Animace',
        type: 'lottie',
      });
    }
  }

  // Look for any .json URLs that might be Lottie files
  const jsonUrlRegex = /["'](https?:\/\/[^"']+\.json)["']/gi;
  while ((match = jsonUrlRegex.exec(html)) !== null) {
    const url = match[1];
    // Check if it looks like a Lottie file (common patterns)
    if (
      (url.includes('lottie') || url.includes('animation') || url.includes('anim')) &&
      !images.some(img => img.url === url)
    ) {
      images.push({
        url,
        alt: 'Animace',
        type: 'lottie',
      });
    }
  }

  // Look for data-animation-src or animation-src attributes
  const animSrcRegex = /(?:data-)?animation-src=["']([^"']+)["']/gi;
  while ((match = animSrcRegex.exec(html)) !== null) {
    const url = match[1];
    if (!images.some(img => img.url === url)) {
      images.push({
        url,
        alt: 'Animace',
        type: url.endsWith('.json') ? 'lottie' : 'image',
      });
    }
  }

  return images;
}

/**
 * Get context/surrounding text for an image to help with placement
 */
export function getImageContext(html: string, imageUrl: string): string {
  // Find the image in the HTML and extract nearby text
  const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const contextRegex = new RegExp(
    `(?:<p[^>]*>([^<]{0,200})<\/p>)?[^<]*<img[^>]+src=["']${escapedUrl}["'][^>]*>[^<]*(?:<p[^>]*>([^<]{0,200})<\/p>)?`,
    'i'
  );
  
  const match = html.match(contextRegex);
  if (match) {
    const before = match[1]?.trim() || '';
    const after = match[2]?.trim() || '';
    return `${before} ${after}`.trim();
  }
  
  return '';
}

/**
 * Create image blocks from extracted images
 */
export function createImageBlocks(images: ExtractedImage[]): Array<{
  type: 'image';
  content: {
    url: string;
    alt?: string;
    caption?: string;
    size: 'small' | 'medium' | 'large' | 'full';
    alignment: 'left' | 'center' | 'right';
  };
}> {
  return images
    .filter(img => img.type === 'image' && img.url) // Only regular images for now
    .map(img => ({
      type: 'image' as const,
      content: {
        url: img.url,
        alt: img.alt || undefined,
        caption: img.caption || undefined,
        size: 'medium' as const,
        alignment: 'center' as const,
      },
    }));
}

/**
 * Format images info for AI prompt
 * Note: Excludes base64 data URLs from prompt (they will be added separately after generation)
 */
export function formatImagesForPrompt(images: ExtractedImage[]): string {
  if (images.length === 0) return '';
  
  // Filter out base64 data URLs - they're too long for the prompt
  // These images will be added as separate blocks after AI generation
  const imageDescriptions = images
    .filter(img => img.type === 'image' && img.url && !img.url.startsWith('data:'))
    .map((img, index) => {
      // Truncate very long URLs
      const displayUrl = img.url.length > 100 ? img.url.substring(0, 100) + '...' : img.url;
      const parts = [`Obrázek ${index + 1}: ${displayUrl}`];
      if (img.alt) parts.push(`Popis: "${img.alt}"`);
      if (img.caption) parts.push(`Titulek: "${img.caption}"`);
      return parts.join(', ');
    });
  
  if (imageDescriptions.length === 0) return '';
  
  return `\n\n### Dostupné obrázky:\n${imageDescriptions.join('\n')}\n\nPokud je to vhodné, můžeš tyto obrázky vložit do pracovního listu pomocí bloku typu "image" s odpovídající URL.`;
}









