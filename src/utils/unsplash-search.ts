/**
 * Unsplash Image Search
 * 
 * Searches for relevant images on Unsplash based on keywords
 * Free API: 50 requests/hour for demo, or use your own API key
 */

// Unsplash API configuration
// For production, use your own API key from https://unsplash.com/developers
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || 'demo';

export interface UnsplashImage {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  author: string;
  authorUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
}

export interface UnsplashSearchResult {
  images: UnsplashImage[];
  total: number;
  totalPages: number;
}

/**
 * Search Unsplash for images
 */
export async function searchUnsplashImages(
  query: string,
  options: {
    perPage?: number;
    page?: number;
    orientation?: 'landscape' | 'portrait' | 'squarish';
  } = {}
): Promise<UnsplashSearchResult> {
  const { perPage = 5, page = 1, orientation } = options;

  console.log('[Unsplash] API Key configured:', UNSPLASH_ACCESS_KEY ? 'YES (first 10 chars: ' + UNSPLASH_ACCESS_KEY.substring(0, 10) + '...)' : 'NO');
  console.log('[Unsplash] Query:', query);

  // If no API key, use Unsplash Source API (free, no auth needed, real search)
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === 'demo') {
    console.log('[Unsplash] Using Unsplash Source API (no API key configured)');
    return getFallbackImages(query, perPage);
  }
  
  console.log('[Unsplash] Using official Unsplash API');

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      page: String(page),
      ...(orientation && { orientation }),
    });

    const response = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Unsplash] API error:', response.status, error);
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();

    const images: UnsplashImage[] = data.results.map((photo: any) => ({
      id: photo.id,
      url: photo.urls.regular,
      thumbUrl: photo.urls.thumb,
      alt: photo.alt_description || photo.description || query,
      author: photo.user.name,
      authorUrl: photo.user.links.html,
      downloadUrl: photo.links.download_location,
      width: photo.width,
      height: photo.height,
    }));

    return {
      images,
      total: data.total,
      totalPages: data.total_pages,
    };
  } catch (error) {
    console.error('[Unsplash] Search error:', error);
    return getFallbackImages(query, perPage);
  }
}

/**
 * Get images using Unsplash Source API - free, no auth needed, but with keyword search
 * https://source.unsplash.com/
 * 
 * Note: This returns real Unsplash images based on the search query
 */
function getFallbackImages(query: string, count: number = 5): UnsplashSearchResult {
  console.log('[Unsplash Source] Searching for:', query);
  
  // Clean and encode the query for URL
  const cleanQuery = query.trim().replace(/\s+/g, ',');
  
  // Generate images using Unsplash Source URLs
  // Format: https://source.unsplash.com/800x600/?keyword1,keyword2
  // Adding unique sig parameter to get different images
  const images: UnsplashImage[] = [];
  
  for (let i = 0; i < count; i++) {
    // Add timestamp + index to get different images for each request
    const sig = `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
    const url = `https://source.unsplash.com/800x600/?${encodeURIComponent(cleanQuery)}&sig=${sig}`;
    const thumbUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(cleanQuery)}&sig=${sig}`;
    
    images.push({
      id: `unsplash-source-${i}-${sig}`,
      url: url,
      thumbUrl: thumbUrl,
      alt: `Obrázek: ${query}`,
      author: 'Unsplash',
      authorUrl: 'https://unsplash.com',
      downloadUrl: '',
      width: 800,
      height: 600,
    });
  }

  console.log('[Unsplash Source] Generated', count, 'image URLs for query:', cleanQuery);

  return {
    images,
    total: count,
    totalPages: 1,
  };
}

/**
 * Extract keywords from text for image search
 * Prioritizes concrete nouns and scientific terms that can be visualized
 */
export function extractSearchKeywords(text: string, maxKeywords: number = 3): string[] {
  // Common stop words and words that don't make good image searches
  const stopWords = new Set([
    // Czech stop words
    'a', 'i', 'o', 'u', 'v', 'k', 's', 'z', 'na', 'do', 'od', 'pro', 'při', 'po',
    'je', 'jsou', 'byl', 'byla', 'bylo', 'být', 'bude', 'budou',
    'to', 'ta', 'ten', 'ty', 'ti', 'tě', 'toto', 'tato', 'tyto', 'toho', 'tomu', 'této',
    'co', 'jak', 'kde', 'kdy', 'proč', 'který', 'která', 'které', 'kteří',
    'nebo', 'ale', 'když', 'že', 'aby', 'protože', 'pokud', 'jestli',
    'se', 'si', 'ho', 'mu', 'mi', 'mě', 'nám', 'vám', 'jim', 'jej', 'něj',
    'jako', 'také', 'tak', 'jen', 'pouze', 'velmi', 'více', 'méně', 'ještě', 'již', 'už',
    'tím', 'čím', 'něco', 'nic', 'někdo', 'nikdo', 'všechno', 'každý', 'některý',
    'tento', 'tenhle', 'tamten', 'onen', 'sám', 'sama', 'samo', 'svůj', 'jeho', 'její',
    'náš', 'váš', 'jejich', 'můj', 'tvůj',
    // English stop words
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'can', 'could', 'may', 'might', 'must', 'shall', 'should',
    // Worksheet-specific words
    'pracovní', 'list', 'test', 'otázka', 'odpověď', 'úloha', 'cvičení',
    'nový', 'nová', 'nové', 'první', 'druhý', 'třetí', 'další',
    'jeden', 'jedna', 'jedno', 'dva', 'dvě', 'tři', 'čtyři', 'pět',
    // Generic/abstract words that don't visualize well
    'věc', 'věci', 'způsob', 'případ', 'příklad', 'skutečnost', 'možnost',
    'problém', 'otázka', 'odpověď', 'informace', 'materiál', 'obsah',
    'část', 'celek', 'základ', 'princip', 'proces', 'postup', 'metoda',
  ]);

  // Verb endings to filter out (Czech verbs are not good for image search)
  const verbEndings = ['ovat', 'ávat', 'ít', 'ět', 'at', 'it', 'out', 'ýt', 'íst', 'ést'];
  const isLikelyVerb = (word: string): boolean => {
    return verbEndings.some(ending => word.endsWith(ending) && word.length > ending.length + 2);
  };

  // Adjective/adverb endings to deprioritize
  const adjectiveEndings = ['ný', 'ná', 'né', 'ní', 'ký', 'ká', 'ké', 'ší', 'čí', 'ově', 'sky'];
  const isLikelyAdjective = (word: string): boolean => {
    return adjectiveEndings.some(ending => word.endsWith(ending));
  };

  // Extract words
  const words = text
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/[^\wáčďéěíňóřšťúůýž\s]/gi, ' ') // Keep only letters
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Score each word based on how good it is for image search
  const scoredWords = words.map(word => {
    let score = 0;
    
    // High priority: word is in our translation dictionary (known educational term)
    if (czechToEnglish[word]) {
      score += 100;
    }
    
    // Medium priority: concrete nouns (4-8 chars are usually nouns)
    if (word.length >= 4 && word.length <= 10) {
      score += 20;
    }
    
    // Low priority: verbs (they don't make good image searches)
    if (isLikelyVerb(word)) {
      score -= 50;
    }
    
    // Medium-low priority: adjectives
    if (isLikelyAdjective(word)) {
      score -= 20;
    }
    
    // Very long words are often compound/abstract
    if (word.length > 12) {
      score -= 10;
    }
    
    return { word, score };
  });

  // Sort by score descending, then deduplicate
  scoredWords.sort((a, b) => b.score - a.score);
  
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const { word, score } of scoredWords) {
    if (!seen.has(word) && result.length < maxKeywords) {
      seen.add(word);
      result.push(word);
      console.log(`[Keywords] "${word}" (score: ${score}, translated: ${czechToEnglish[word] || 'no'})`);
    }
  }
  
  return result;
}

/**
 * Translate Czech keywords to English for better image search results
 * Comprehensive dictionary for educational topics
 */
const czechToEnglish: Record<string, string> = {
  // Physics - Hmota, síly, pohyb
  'hmota': 'matter',
  'hmoty': 'matter',
  'látka': 'substance',
  'látky': 'substances',
  'těleso': 'object',
  'tělesa': 'objects',
  'síla': 'force',
  'síly': 'forces',
  'pohyb': 'motion',
  'rychlost': 'speed',
  'zrychlení': 'acceleration',
  'setrvačnost': 'inertia',
  'tření': 'friction',
  'tlak': 'pressure',
  'hustota': 'density',
  'objem': 'volume',
  'hmotnost': 'mass',
  'váha': 'weight',
  
  // States of matter
  'pevný': 'solid',
  'kapalný': 'liquid',
  'plynný': 'gas',
  'skupenství': 'state of matter',
  'tání': 'melting',
  'vření': 'boiling',
  'vypařování': 'evaporation',
  'kondenzace': 'condensation',
  
  // Nature
  'voda': 'water',
  'oheň': 'fire',
  'vzduch': 'air',
  'země': 'earth',
  'hora': 'mountain',
  'hory': 'mountains',
  'moře': 'sea',
  'řeka': 'river',
  'les': 'forest',
  'strom': 'tree',
  'stromy': 'trees',
  'květina': 'flower',
  'zvíře': 'animal',
  'zvířata': 'animals',
  'pták': 'bird',
  'ryba': 'fish',
  'rostlina': 'plant',
  'rostliny': 'plants',
  
  // Science
  'atom': 'atom',
  'atomy': 'atoms',
  'molekula': 'molecule',
  'molekuly': 'molecules',
  'buňka': 'cell',
  'buňky': 'cells',
  'energie': 'energy',
  'elektřina': 'electricity',
  'elektrický': 'electric',
  'magnetismus': 'magnet',
  'magnetický': 'magnetic',
  'světlo': 'light',
  'zvuk': 'sound',
  'teplo': 'heat',
  'teplota': 'temperature',
  'gravitace': 'gravity',
  'fyzika': 'physics',
  'chemie': 'chemistry',
  'biologie': 'biology',
  'matematika': 'mathematics',
  'geometrie': 'geometry',
  'věda': 'science',
  'experiment': 'experiment',
  'laboratoř': 'laboratory',
  
  // Chemistry
  'prvek': 'element',
  'sloučenina': 'compound',
  'reakce': 'reaction',
  'kyselina': 'acid',
  'zásada': 'base',
  'roztok': 'solution',
  'krystal': 'crystal',
  
  // Biology
  'orgán': 'organ',
  'sval': 'muscle',
  'kost': 'bone',
  'krev': 'blood',
  'dýchání': 'breathing',
  'trávení': 'digestion',
  'fotosyntéza': 'photosynthesis',
  'evoluce': 'evolution',
  'dědičnost': 'genetics',
  
  // History
  'historie': 'history',
  'starověk': 'ancient',
  'středověk': 'medieval',
  'novověk': 'modern history',
  'pravěk': 'prehistoric',
  'egyptský': 'egyptian',
  'egypt': 'egypt pyramid',
  'římský': 'roman',
  'řím': 'rome ancient',
  'řecký': 'greek',
  'řecko': 'greece ancient',
  'válka': 'war',
  'bitva': 'battle',
  'král': 'king',
  'královna': 'queen',
  'hrad': 'castle',
  'zámek': 'palace',
  'pyramida': 'pyramid',
  'chrám': 'temple',
  
  // Geography
  'mapa': 'map',
  'kontinent': 'continent',
  'ostrov': 'island',
  'poušť': 'desert',
  'oceán': 'ocean',
  'jezero': 'lake',
  'město': 'city',
  'vesnice': 'village',
  'krajina': 'landscape',
  'klima': 'climate',
  'počasí': 'weather',
  
  // Astronomy
  'vesmír': 'space universe',
  'planeta': 'planet',
  'hvězda': 'star',
  'slunce': 'sun',
  'měsíc': 'moon',
  'galaxie': 'galaxy',
  'sluneční': 'solar',
  
  // Technology
  'stroj': 'machine',
  'motor': 'engine',
  'počítač': 'computer',
  'robot': 'robot',
  'technologie': 'technology',
  'vynález': 'invention',
  
  // School subjects
  'čtení': 'reading',
  'psaní': 'writing',
  'počítání': 'counting',
  'malování': 'painting',
  'hudba': 'music',
  'sport': 'sport',
  
  // Common topics
  'rodina': 'family',
  'škola': 'school classroom',
  'práce': 'work',
  'jídlo': 'food',
  'zdraví': 'health',
  'člověk': 'human',
  'lidé': 'people',
  'tělo': 'human body',
  'srdce': 'heart',
  'mozek': 'brain',
  'oko': 'eye',
  'ucho': 'ear',
};

export function translateKeywords(keywords: string[]): string[] {
  return keywords.map(keyword => {
    const lower = keyword.toLowerCase();
    // Check if we have a translation
    for (const [czech, english] of Object.entries(czechToEnglish)) {
      if (lower.includes(czech)) {
        return english;
      }
    }
    // Return original if no translation found
    return keyword;
  });
}

/**
 * Search for images based on worksheet content
 * Prioritizes actual content over generic titles
 */
export async function searchImagesForWorksheet(
  title: string,
  topic?: string,
  content?: string
): Promise<UnsplashImage[]> {
  // Skip generic/default titles
  const genericTitles = ['nový pracovní list', 'pracovní list', 'test', 'nový', 'cvičení'];
  const isGenericTitle = genericTitles.some(g => title.toLowerCase().includes(g));
  
  // Build search text - prioritize CONTENT over title if title is generic
  let searchTexts: string[] = [];
  
  // Content is most important - use first 1500 chars
  if (content && content.length > 20) {
    searchTexts.push(content.substring(0, 1500));
  }
  
  // Topic if provided
  if (topic) {
    searchTexts.push(topic);
  }
  
  // Title only if not generic
  if (!isGenericTitle && title) {
    searchTexts.push(title);
  }
  
  const fullText = searchTexts.join(' ');
  
  if (fullText.length < 10) {
    console.log('[ImageSearch] Not enough content to search');
    return (await searchUnsplashImages('education science', { perPage: 5 })).images;
  }
  
  console.log('[ImageSearch] Search text length:', fullText.length);
  console.log('[ImageSearch] First 200 chars:', fullText.substring(0, 200));
  
  // Extract keywords - more keywords for better matching
  const keywords = extractSearchKeywords(fullText, 8);
  
  console.log('[ImageSearch] Extracted keywords:', keywords);
  
  // Translate to English - take best 3-4 translated terms
  const translatedKeywords = translateKeywords(keywords).slice(0, 4);
  
  console.log('[ImageSearch] Translated keywords:', translatedKeywords);
  
  if (translatedKeywords.length === 0 || translatedKeywords.every(k => k === keywords[0])) {
    // No translations found, try to use the raw keywords but look for common terms
    console.log('[ImageSearch] No good translations, using generic science search');
    return (await searchUnsplashImages('science education', { perPage: 5 })).images;
  }

  // Use only the best 2-3 keywords for cleaner search
  const query = translatedKeywords.slice(0, 3).join(' ');
  console.log('[ImageSearch] Final search query:', query);

  const result = await searchUnsplashImages(query, {
    perPage: 5,
    orientation: 'landscape',
  });

  return result.images;
}

/**
 * Trigger download tracking (required by Unsplash API guidelines)
 */
export async function trackDownload(downloadUrl: string): Promise<void> {
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === 'demo') return;

  try {
    await fetch(downloadUrl, {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    });
  } catch (error) {
    console.warn('[Unsplash] Failed to track download:', error);
  }
}









