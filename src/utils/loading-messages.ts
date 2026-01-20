/**
 * Loading Messages Generator
 * 
 * Generuje kontextové loading hlášky na základě obsahu dokumentu
 */

// Šablony pro loading hlášky
const MESSAGE_TEMPLATES = [
  'Přemýšlím o {topic}...',
  'Skládám {topic} dohromady...',
  'Analyzuji {topic}...',
  'Hledám zajímavosti o {topic}...',
  'Vytvářím otázky o {topic}...',
  'Připravuji cvičení na {topic}...',
  'Prozkoumávám {topic}...',
  'Dávám {topic} do kontextu...',
];

const GENERIC_MESSAGES = [
  'Vytvářím další otázku...',
  'Přidávám zajímavé cvičení...',
  'Formuluji odpovědi...',
  'Kontroluji správnost...',
  'Přemýšlím nad variantami...',
  'Dávám to všechno dohromady...',
  'Skoro hotovo...',
  'Ještě moment...',
  'Ladím detaily...',
  'Finální úpravy...',
];

const SUBJECT_SPECIFIC_TEMPLATES: Record<string, string[]> = {
  'fyzika': [
    'Počítám síly...',
    'Měřím rychlost...',
    'Zkoumám pohyb...',
    'Analyzuji energii...',
    'Simuluji experiment...',
  ],
  'chemie': [
    'Míchám prvky...',
    'Vyvažuji rovnice...',
    'Zkoumám reakce...',
    'Analyzuji molekuly...',
  ],
  'matematika': [
    'Počítám rovnice...',
    'Řeším příklady...',
    'Kontroluji výsledky...',
    'Kreslím grafy...',
  ],
  'biologie': [
    'Zkoumám buňky...',
    'Analyzuji organismy...',
    'Studuji ekosystém...',
  ],
};

/**
 * Extrahuje klíčová slova z textu
 */
export function extractKeywords(content: string, title: string): string[] {
  const keywords: string[] = [];
  
  // Přidej název dokumentu
  if (title) {
    keywords.push(title.toLowerCase());
  }
  
  // Vyčisti HTML tagy
  const textContent = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  
  // Hledej důležitá slova (podstatná jména, odborné termíny)
  // Jednoduchá heuristika: slova delší než 4 znaky, která se opakují
  const words = textContent.split(/\s+/);
  const wordCount: Record<string, number> = {};
  
  for (const word of words) {
    // Vyčisti interpunkci
    const cleanWord = word.replace(/[^a-záčďéěíňóřšťúůýž]/gi, '');
    if (cleanWord.length > 4) {
      wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
    }
  }
  
  // Seřaď podle frekvence a vezmi top 10
  const sortedWords = Object.entries(wordCount)
    .filter(([_, count]) => count > 1) // Jen slova, která se opakují
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
  
  keywords.push(...sortedWords);
  
  // Hledej nadpisy (h2, h3)
  const headingMatches = content.match(/<h[23][^>]*>([^<]+)<\/h[23]>/gi);
  if (headingMatches) {
    for (const match of headingMatches.slice(0, 5)) {
      const text = match.replace(/<[^>]*>/g, '').trim().toLowerCase();
      if (text.length > 2 && text.length < 30) {
        keywords.push(text);
      }
    }
  }
  
  return [...new Set(keywords)]; // Unikátní
}

/**
 * Generuje loading zprávy na základě obsahu
 */
export function generateLoadingMessages(
  content: string, 
  title: string, 
  subject?: string
): string[] {
  const keywords = extractKeywords(content, title);
  const messages: string[] = [];
  
  // Přidej zprávy s konkrétními tématy
  for (const keyword of keywords.slice(0, 5)) {
    const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)];
    messages.push(template.replace('{topic}', keyword));
  }
  
  // Přidej subject-specific zprávy
  if (subject) {
    const subjectLower = subject.toLowerCase();
    for (const [key, templates] of Object.entries(SUBJECT_SPECIFIC_TEMPLATES)) {
      if (subjectLower.includes(key)) {
        messages.push(...templates);
        break;
      }
    }
  }
  
  // Přidej generické zprávy
  messages.push(...GENERIC_MESSAGES);
  
  // Zamíchej a vrať
  return shuffleArray(messages);
}

/**
 * Zamíchá pole
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Hook-friendly: Vrací funkci, která vrací další zprávu
 */
export function createMessageRotator(messages: string[]): () => string {
  let index = 0;
  return () => {
    const message = messages[index % messages.length];
    index++;
    return message;
  };
}


