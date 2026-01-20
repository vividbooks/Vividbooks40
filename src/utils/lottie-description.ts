import OpenAI from 'openai';

// Get API key from localStorage or env variable
function getOpenAIKey(): string {
  // First check localStorage (runtime configuration)
  if (typeof window !== 'undefined') {
    const storedKey = localStorage.getItem('openai_api_key');
    if (storedKey) return storedKey;
  }
  // Fallback to env variable
  return import.meta.env.VITE_OPENAI_API_KEY || '';
}

export interface LottieDescriptionResult {
  shortDescription: string;
  detailedDescription: string;
  keywords: string[];
}

function createOpenAIClient() {
  return new OpenAI({
    apiKey: getOpenAIKey(),
    dangerouslyAllowBrowser: true 
  });
}

/**
 * Main function: Generate description for a Lottie animation
 */
export async function generateLottieDescription(lottieUrl: string, context?: string, userHint?: string): Promise<LottieDescriptionResult> {
  console.log('generateLottieDescription: Starting for URL (OpenAI):', lottieUrl, 'Context:', context, 'Hint:', userHint);
  
  try {
    // Capture frames from animation
    const frames = await captureLottieFrames(lottieUrl);
    
    if (frames.length === 0) {
      throw new Error('No frames captured');
    }
    
    console.log('generateLottieDescription: Captured', frames.length, 'frames, sending to GPT-4o Vision...');
    
    // Analyze frames with OpenAI GPT-4o
    const result = await analyzeFramesWithOpenAI(frames, context, userHint);
    console.log('generateLottieDescription: Complete!', result);
    
    return result;
  } catch (error) {
    console.error('generateLottieDescription: Error:', error);
    throw error;
  }
}

/**
 * Capture frames from Lottie animation using lottie-web
 */
async function captureLottieFrames(lottieUrl: string): Promise<string[]> {
  console.log('captureLottieFrames: Fetching Lottie JSON...');
  
  // Fetch Lottie JSON
  const response = await fetch(lottieUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Lottie: ${response.status}`);
  }
  const animationData = await response.json();
  console.log('captureLottieFrames: JSON loaded, totalFrames:', animationData.op);
  
  // Create hidden container - optimized size for balance between detail and cost
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:300px;height:300px;background:white;';
  document.body.appendChild(container);
  
  const frames: string[] = [];
  
  try {
    // Import lottie-web
    const lottieModule = await import('lottie-web');
    const lottie = lottieModule.default;
    
    // Create animation
    const anim = lottie.loadAnimation({
      container,
      renderer: 'canvas',
      loop: false,
      autoplay: false,
      animationData,
    });
    
    // Wait for ready
    await new Promise<void>((resolve) => {
      const onReady = () => {
        console.log('captureLottieFrames: Animation ready');
        resolve();
      };
      anim.addEventListener('DOMLoaded', onReady);
      setTimeout(onReady, 2000); // Fallback
    });
    
    await sleep(500); // Wait a bit more for rendering
    
    // Capture 6 frames (0%, 20%, 40%, 60%, 80%, 100%) - optimal balance
    const totalFrames = anim.totalFrames || 100;
    const framePositions = [0, 0.2, 0.4, 0.6, 0.8, 0.98].map(p => Math.floor(p * totalFrames));
    
    for (const frameNum of framePositions) {
      anim.goToAndStop(frameNum, true);
      await sleep(150);
      
      const canvas = container.querySelector('canvas');
      if (canvas) {
        try {
          // Medium quality (0.6) and 300px size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const base64 = dataUrl.split(',')[1];
          if (base64 && base64.length > 100) {
            frames.push(base64);
          }
        } catch (e) {
          console.warn('captureLottieFrames: toDataURL failed:', e);
        }
      }
    }
    
    anim.destroy();
  } finally {
    document.body.removeChild(container);
  }
  
  return frames;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Analyze frames with OpenAI GPT-4o
 */
async function analyzeFramesWithOpenAI(frames: string[], context?: string, userHint?: string): Promise<LottieDescriptionResult> {
  const isAnimation = frames.length > 1;
  const mediaType = isAnimation ? "animaci" : "obrázek";
  const mediaTypeGen = isAnimation ? "animace" : "obrázku"; // genitiv

  // Explicitly frame as an accessibility/educational task to avoid safety refusals
  const prompt = `Jsi asistent pro tvorbu přístupných výukových materiálů.
Tvým úkolem je popsat tento vzdělávací ${mediaType} (fyzika/příroda) pro nevidomé studenty.
${context ? `\nTéma lekce: "${context}".` : ''}
${userHint ? `\nUŽIVATELŮV POPIS (co je na ${mediaTypeGen}): "${userHint}".\nTento popis ber jako výchozí bod. Rozveď ho, doplň detaily z vizuální analýzy a oprav případné nepřesnosti.` : ''}

Popiš, co na ${isAnimation ? 'snímcích' : 'obrázku'} je, aby si student dokázal ${mediaType} představit.

Formát odpovědi (JSON):
{
  "shortDescription": "Komplexní popis ${mediaTypeGen} o délce jednoho odstavce (4-6 vět). Detailně popiš vizuální stránku i vzdělávací význam.",
  "detailedDescription": "Detailní popis ${isAnimation ? 'průběhu animace' : 'vizuálních prvků'} a detailů.",
  "keywords": ["klíčové slovo 1", "klíčové slovo 2", "klíčové slovo 3"]
}`;

  const content: any[] = [
    { type: "text", text: prompt }
  ];

  // Add images
  frames.forEach(base64 => {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64}`,
        detail: "auto" // Auto allows OpenAI to decide best resolution processing
      }
    });
  });

  console.log('analyzeFramesWithOpenAI: Sending request to OpenAI...');

  try {
    const openai = createOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
      max_tokens: 500,
    });

    const text = completion.choices[0].message.content || '';
    console.log('analyzeFramesWithOpenAI: Response:', text);
    
    // Parse JSON (handle potential markdown blocks)
    const jsonStr = text.replace(/```json|```/g, '').trim();
    
    try {
      const result = JSON.parse(jsonStr);
      return {
        shortDescription: result.shortDescription || '',
        detailedDescription: result.detailedDescription || '',
        keywords: result.keywords || []
      };
    } catch (e) {
      console.error('analyzeFramesWithOpenAI: JSON parse error:', e);
      return {
        shortDescription: text.substring(0, 200),
        detailedDescription: '',
        keywords: []
      };
    }
  } catch (error) {
    console.error('analyzeFramesWithOpenAI: OpenAI API error:', error);
    throw error;
  }
}

/**
 * Generate description for an image URL
 */
export async function generateImageDescription(imageUrl: string, context?: string, userHint?: string): Promise<LottieDescriptionResult> {
  console.log('generateImageDescription: Starting for URL:', imageUrl, 'Context:', context, 'Hint:', userHint);
  
  // Fetch image and convert to base64
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const result = await analyzeFramesWithOpenAI([base64], context, userHint);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsDataURL(blob);
  });
}

