/**
 * Lottie Screenshot Generator
 * 
 * Generates static PNG screenshots from Lottie animations
 * for use in worksheets where animations can't be displayed
 */

import lottie, { AnimationItem } from 'lottie-web';

export interface LottieScreenshotOptions {
  /** Frame to capture (0 = first frame, -1 = middle frame) */
  frame?: number | 'first' | 'middle' | 'last';
  /** Output width in pixels */
  width?: number;
  /** Output height in pixels */
  height?: number;
  /** Image quality for JPEG (0-1) */
  quality?: number;
  /** Output format */
  format?: 'png' | 'jpeg';
}

interface LottieData {
  w?: number;
  h?: number;
  fr?: number;
  ip?: number;
  op?: number;
  [key: string]: unknown;
}

/**
 * Generate a screenshot from a Lottie animation URL
 */
export async function generateLottieScreenshot(
  lottieUrl: string,
  options: LottieScreenshotOptions = {}
): Promise<string> {
  const {
    frame = 'first',
    width = 400,
    height,
    quality = 0.92,
    format = 'png',
  } = options;

  try {
    // Fetch the Lottie JSON
    const response = await fetch(lottieUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Lottie: ${response.status}`);
    }
    const lottieData: LottieData = await response.json();

    return await generateScreenshotFromData(lottieData, {
      frame,
      width,
      height,
      quality,
      format,
    });
  } catch (error) {
    console.error('Error generating Lottie screenshot:', error);
    throw error;
  }
}

/**
 * Generate a screenshot from Lottie JSON data
 */
export async function generateScreenshotFromData(
  lottieData: LottieData,
  options: LottieScreenshotOptions = {}
): Promise<string> {
  const {
    frame = 'first',
    width = 400,
    height,
    quality = 0.92,
    format = 'png',
  } = options;

  return new Promise((resolve, reject) => {
    // Create a hidden container for the animation
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.visibility = 'hidden';
    document.body.appendChild(container);

    // Calculate dimensions
    const originalWidth = lottieData.w || 400;
    const originalHeight = lottieData.h || 400;
    const aspectRatio = originalHeight / originalWidth;
    const outputWidth = width;
    const outputHeight = height || Math.round(width * aspectRatio);

    container.style.width = `${outputWidth}px`;
    container.style.height = `${outputHeight}px`;

    let animation: AnimationItem | null = null;

    try {
      // Load the animation
      animation = lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: lottieData,
      });

      // Wait for animation to be ready
      animation.addEventListener('DOMLoaded', () => {
        try {
          // Calculate target frame
          const totalFrames = animation!.totalFrames;
          let targetFrame: number;

          if (frame === 'first') {
            targetFrame = 0;
          } else if (frame === 'middle') {
            targetFrame = Math.floor(totalFrames / 2);
          } else if (frame === 'last') {
            targetFrame = totalFrames - 1;
          } else {
            targetFrame = Math.min(Math.max(0, frame), totalFrames - 1);
          }

          // Go to the target frame
          animation!.goToAndStop(targetFrame, true);

          // Small delay to ensure rendering is complete
          setTimeout(() => {
            try {
              // Get the SVG element
              const svgElement = container.querySelector('svg');
              if (!svgElement) {
                throw new Error('SVG element not found');
              }

              // Convert SVG to image
              convertSvgToImage(svgElement, outputWidth, outputHeight, format, quality)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                  // Cleanup
                  if (animation) {
                    animation.destroy();
                  }
                  document.body.removeChild(container);
                });
            } catch (err) {
              reject(err);
            }
          }, 100);
        } catch (err) {
          reject(err);
        }
      });

      animation.addEventListener('error', () => {
        reject(new Error('Lottie animation failed to load'));
      });
    } catch (err) {
      // Cleanup on error
      if (animation) {
        animation.destroy();
      }
      document.body.removeChild(container);
      reject(err);
    }
  });
}

/**
 * Convert SVG element to image data URL
 */
async function convertSvgToImage(
  svgElement: SVGElement,
  width: number,
  height: number,
  format: 'png' | 'jpeg',
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Clone the SVG and set dimensions
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width', String(width));
    svgClone.setAttribute('height', String(height));

    // Serialize SVG to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Create image from SVG
    const img = new Image();
    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Fill with white background for JPEG
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to data URL
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        URL.revokeObjectURL(svgUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(svgUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = svgUrl;
  });
}

/**
 * Check if a URL points to a Lottie JSON file
 */
export function isLottieUrl(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith('.json') || lowerUrl.includes('lottie');
}

/**
 * Process extracted images and generate screenshots for Lottie animations
 */
export async function processImagesWithLottieScreenshots(
  images: Array<{ url: string; alt: string; type: 'image' | 'lottie'; lottieData?: string }>
): Promise<Array<{ url: string; alt: string; type: 'image' }>> {
  const results: Array<{ url: string; alt: string; type: 'image' }> = [];

  for (const img of images) {
    if (img.type === 'lottie' && img.url) {
      try {
        console.log('[Lottie] Generating screenshot for:', img.url);
        const screenshot = await generateLottieScreenshot(img.url, {
          frame: 'middle',
          width: 600,
        });
        results.push({
          url: screenshot,
          alt: img.alt || 'Animace (statický náhled)',
          type: 'image',
        });
        console.log('[Lottie] Screenshot generated successfully');
      } catch (error) {
        console.warn('[Lottie] Failed to generate screenshot:', error);
        // Skip failed Lottie animations
      }
    } else if (img.type === 'image' && img.url) {
      results.push({
        url: img.url,
        alt: img.alt,
        type: 'image',
      });
    }
  }

  return results;
}









