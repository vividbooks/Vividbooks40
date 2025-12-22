/**
 * Gemini RAG - File Search API wrapper pro Vividbooks
 * 
 * Umožňuje:
 * - Automatickou indexaci vzdělávacích materiálů
 * - AI tutoring chat s RAG (Retrieval Augmented Generation)
 */

import { GoogleGenAI } from '@google/genai';
import { chatWithAIProxy, shouldUseProxy } from './ai-chat-proxy';

// API klíč - preferuje localStorage, pak env variable, pak fallback
// V produkci přesuňte do .env souboru jako VITE_GEMINI_API_KEY
function getGeminiApiKey(): string {
  // First check localStorage
  if (typeof window !== 'undefined') {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) return storedKey;
  }
  // Then check env variable - no fallback (use proxy instead)
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

// Export setter for runtime configuration
export function setGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gemini_api_key', key);
  }
}

// Export getter for checking current key
export function getGeminiKey(): string {
  return getGeminiApiKey();
}

// Inicializace Gemini AI - lazy initialization to use current key
function createGeminiAI() {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}
const ai = createGeminiAI();

const STORE_NAME = 'vividbooks-content';
let storeId: string | null = null;

/**
 * Kontrola, zda je Gemini API nakonfigurováno
 * Vrací true pokud je k dispozici lokální klíč NEBO proxy
 */
export function isGeminiConfigured(): boolean {
  // Either local key or proxy (which uses Supabase secrets)
  return !!getGeminiApiKey() || shouldUseProxy();
}

/**
 * Inicializace - získat nebo vytvořit RAG store
 */
export async function initializeRAGStore(): Promise<string> {
  if (storeId) return storeId;

  try {
    // Zkusit najít existující store
    const stores = await ai.fileSearchStores.list();
    for await (const store of stores) {
      if (store.displayName === STORE_NAME) {
        storeId = store.name!;
        return storeId;
      }
    }

    // Vytvořit nový store
    const newStore = await ai.fileSearchStores.create({
      config: { displayName: STORE_NAME }
    });
    storeId = newStore.name!;
    return storeId;
  } catch (error) {
    console.error('Error initializing RAG store:', error);
    throw error;
  }
}

/**
 * Metadata pro dokument v RAG
 */
export interface RAGDocumentMetadata {
  vividbooks_id: string;
  subject: string;
  grade: string;
  topic: string;
  type: 'lekce' | 'metodika' | 'pracovni_list' | 'ucebnice';
  created_by: 'admin';
}

/**
 * Parametry pro nahrání dokumentu do RAG
 */
export interface UploadDocumentParams {
  documentId: string;
  title: string;
  content: string;
  subject: string;
  grade: string;
  topic: string;
  type: 'lekce' | 'metodika' | 'pracovni_list' | 'ucebnice';
}

/**
 * Výsledek nahrání dokumentu
 */
export interface UploadResult {
  success: boolean;
  ragDocumentId?: string;
  error?: string;
}

/**
 * Nahrát dokument do RAG (přes REST API Files API)
 */
export async function uploadDocumentToRAG(params: UploadDocumentParams): Promise<UploadResult> {
  console.log('Uploading document to Gemini Files API...', params.title);

  try {
    // 1. Připravit obsah souboru
    const contentWithMetadata = `
# ${params.title}

Předmět: ${params.subject}
Ročník: ${params.grade}. třída
Typ: ${params.type}
ID: ${params.documentId}

---

${params.content}
`.trim();

    // 2. Initial Resumable Upload Request
    const uploadUrlResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${getGeminiApiKey()}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': new TextEncoder().encode(contentWithMetadata).length.toString(),
        'X-Goog-Upload-Header-Content-Type': 'text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: {
          displayName: params.title,
        }
      })
    });

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text();
      console.error('Failed to get upload URL:', errorText);
      throw new Error(`Failed to get upload URL: ${uploadUrlResponse.statusText}`);
    }

    const uploadUrl = uploadUrlResponse.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) {
      throw new Error('No upload URL returned');
    }

    // 3. Upload samotného obsahu
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Type': 'text/plain',
      },
      body: contentWithMetadata
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Failed to upload content:', errorText);
      throw new Error(`Failed to upload content: ${uploadResponse.statusText}`);
    }

    const fileData = await uploadResponse.json();
    const fileUri = fileData.file.uri;
    const fileName = fileData.file.name; // 'files/...'

    console.log('File uploaded successfully:', fileUri);

    // 4. Čekat na zpracování (polling)
    let state = fileData.file.state;
    let attempts = 0;
    while (state === 'PROCESSING' && attempts < 30) {
      console.log('Waiting for file processing...', state);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const checkResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${getGeminiApiKey()}`);
      const checkData = await checkResponse.json();
      state = checkData.state;
      
      if (state === 'FAILED') {
        throw new Error('File processing failed');
      }
    }

    if (state !== 'ACTIVE') {
       console.warn('File not active after polling:', state);
    } else {
       console.log('File is ready:', state);
    }

    return {
      success: true,
      ragDocumentId: fileName, // Ukládáme 'files/XYZ'
    };

  } catch (error) {
    console.error('RAG upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Smazat dokument z RAG
 */
export async function deleteDocumentFromRAG(ragDocumentId: string): Promise<boolean> {
  if (!ragDocumentId.startsWith('files/')) {
     return true;
  }

  try {
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${ragDocumentId}?key=${getGeminiApiKey()}`, {
      method: 'DELETE'
    });
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Parametry pro chat s RAG
 */
export interface ChatWithRAGParams {
  message: string;
  documentId?: string; // ID dokumentu ve Vividbooks (pro filtry)
  ragDocumentId?: string; // ID souboru v Gemini (files/XYZ)
  subject?: string;
  grade?: string;
  topic?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Výsledek chatu s citacemi
 */
export interface ChatResult {
  response: string;
  citations: Array<{ source: string; content: string }>;
}

/**
 * System prompt pro AI učitele
 */
function getTeacherSystemPrompt(grade: string = '6'): string {
  return `Jsi učitel pro ${grade}. třídu. Krátké odpovědi, max 2 věty.

STYL VÝUKY:
- SOKRATOVSKÁ METODA: Nevysvětluj, ptej se!
- Používej příklady ze života (bazén, auto, hřiště...)
- POSTUPUJ KROK ZA KROKEM: Ne shrnutí celé lekce!
- Začni od úvodu a nejjednodušších pojmů
- Nepřeskakuj na konec lekce
- Aktivně odkazuj na obrázky a animace, pokud o nich víš
- Pochval správnou odpověď ("Super!" "Výborně!")
- Pokud žák neví → dej nápovědu, zjednoduš otázku

Odpovídej česky, přátelsky 😊`;
}

/**
 * Chat s RAG - AI tutoring s kontextem souboru
 */
export async function chatWithRAG(params: ChatWithRAGParams): Promise<ChatResult> {
  console.log('Chat with RAG params:', { ...params, message: params.message.substring(0, 50) + '...' });

  try {
    let fileUri: string | undefined;
    const hasLocalKey = !!getGeminiApiKey();

    // Pokud máme ID souboru A lokální klíč, získáme jeho URI pro kontext
    // (Proxy nepodporuje file_uri - potřebujeme lokální klíč pro RAG)
    if (params.ragDocumentId && hasLocalKey) {
      try {
        const fileResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${params.ragDocumentId}?key=${getGeminiApiKey()}`);
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          fileUri = fileData.uri;
          console.log('Found file context:', fileUri);
        } else {
          console.warn('Failed to fetch file metadata for RAG:', params.ragDocumentId);
        }
      } catch (e) {
        console.warn('Error fetching file metadata:', e);
      }
    }
    
    // Pokud nemáme file context a můžeme použít proxy, použijeme simpleChatWithAI
    if (!fileUri && shouldUseProxy()) {
      console.log('No file context, using proxy via simpleChatWithAI...');
      const response = await simpleChatWithAI({
        message: params.message,
        topic: params.topic,
        grade: params.grade,
        conversationHistory: params.conversationHistory
      });
      return { response, citations: [] };
    }

    const systemPrompt = `Jsi přátelský učitel. Piš VELMI KRÁTCE - max 2 věty!

${fileUri ? `MÁŠ PŘÍSTUP K LEKCI: Používej její obsah pro odpovědi.
` : ''}
TÉMA: "${params.topic || 'Obecné'}"

ZLATÁ PRAVIDLA:
1. NIKDY neposílej žáka na "shrnutí" nebo "souhrn" - to je zakázané!
2. Pokud je v textu lekce zmíněna animace nebo obrázek (sekce "POPISY ANIMACÍ"), AKTIVNĚ na ni odkazuj.
   - Příklad: "Podívej se na animaci, kde se sráží atomy. Co se tam děje?"
   - Ptej se na detaily z těch animací, které vidíš v popisu.
3. Neprozrazuj odpovědi rovnou.

JAK UČIT (Sokratovská metoda):
- Tvým cílem je dovést žáka k odpovědi pomocí otázek.
- NEVYSVĚTLUJ TEORII ROVNOU!
- POUŽÍVEJ NÁSTROJE:
  1. ÚVODNÍ TEXT: Pokud žák neví základy, odkaž ho: "Zkus si přečíst úvodní text lekce, tam se píše..."
  2. ANIMACE/OBRÁZKY: Pokud to pomůže vysvětlení, odkaž žáka: "Podívej se na animaci XY..."
  3. PŘÍKLADY ZE ŽIVOTA: "Co se děje, když se potápíš do bazénu?"
  4. ZJEDNODUŠENÍ: Pokud žák tápe, vrať se k základům.

KDYŽ JE ŽÁK ÚPLNĚ ZTRACENÝ (napsal 2x nevím):
1. Nabídni možnosti A/B/C.
2. Teprve pak vysvětluj.

MOŽNOSTI PRO ŽÁKA (záchranná brzda):
Možnosti dávej JEN když žák evidentně tápe (napsal "nevím", "pomoz", je zmatený).
Formát možností:
[[A) první možnost]]
[[B) druhá možnost]]
[[C) Nevím, pomoz mi]]

Většinou možnosti NEDÁVEJ - nech žáka přemýšlet a psát vlastní odpovědi!

STYL:
- MAX 2 VĚTY
- Buď konkrétní
- Používej emoji 😊 👏 🤔`;


    // Sestavit messages
    const contents: any[] = [];

    // Historie
    if (params.conversationHistory) {
      for (const msg of params.conversationHistory) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    // Aktuální zpráva
    // Pokud máme soubor, přidáme ho k aktuální zprávě (nebo k system promptu, ale Gemini preferuje soubor s user message)
    // Abychom ušetřili tokeny, soubor pošleme jen pokud ještě nebyl v kontextu (což u REST stateless API musíme poslat, 
    // ale Gemini to umí cachovat. Pro jednoduchost ho pošleme s poslední zprávou, pokud to je "první" zpráva se souborem,
    // ale tady nemáme stav. 
    // Nejjednodušší: Přidat soubor k poslední zprávě uživatele.
    
    const currentMessageParts: any[] = [{ text: params.message }];
    
    // Pokud máme soubor, přidáme ho do první zprávy nebo do aktuální?
    // Pokud je to první zpráva v konverzaci, přidáme ho.
    // Pokud už je konverzace rozběhlá, model by měl mít kontext (pokud posíláme celou historii a ten soubor byl v historii).
    // ALE my posíláme historii jako text. Soubor tam fyzicky není.
    // Takže ho musíme poslat znovu?
    // Gemini 1.5 má velký kontext. Můžeme ho poslat pokaždé (je to odkaz).
    
    if (fileUri) {
       currentMessageParts.push({
         file_data: {
           mime_type: 'text/plain',
           file_uri: fileUri
         }
       });
    }

    contents.push({
      role: 'user',
      parts: currentMessageParts
    });

    // Vložíme system prompt jako první user message
    // Poznámka: Pokud posíláme file_data, system prompt může být samostatně
    const finalContents = [
      {
        role: 'user',
        parts: [{ text: `[Instrukce]\n${systemPrompt}` }]
      },
      {
        role: 'model',
        parts: [{ text: 'Rozumím.' }]
      },
      ...contents
    ];

    console.log('Calling Gemini API with file context...');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getGeminiApiKey()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: finalContents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.error?.status || '';
      } catch { errorMessage = errorText.substring(0, 200); }
      console.error('Gemini API error:', response.status, errorMessage);
      throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return {
      response: text || 'Omlouvám se, nepodařilo se vygenerovat odpověď.',
      citations: [] // Citace by šly extrahovat, pokud bychom použili semantic retrieval tool, u file contextu je to implicitní
    };

  } catch (error) {
    console.error('Chat with RAG error:', error);
    // Fallback na simple chat
    return {
      response: await simpleChatWithAI({
        message: params.message,
        subject: params.subject,
        grade: params.grade,
        conversationHistory: params.conversationHistory
      }),
      citations: []
    };
  }
}

/**
 * Jednoduchý chat bez RAG (fallback) - používá REST API
 */
export async function simpleChatWithAI(params: {
  message: string;
  subject?: string;
  grade?: string;
  topic?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {

  try {
    const systemPrompt = `${getTeacherSystemPrompt(params.grade)}

${params.topic ? `Aktuální téma: ${params.topic}` : ''}
${params.subject ? `Předmět: ${params.subject}` : ''}`;

    // Use Supabase Edge Function proxy in production
    if (shouldUseProxy()) {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt }
      ];
      
      const history = params.conversationHistory || params.history || [];
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
      messages.push({ role: 'user', content: params.message });
      
      return await chatWithAIProxy(messages, 'gemini-2.5-flash', { temperature: 0.8, max_tokens: 2048 });
    }

    // Sestavit messages pro Gemini API
    const contents = [];
    
    // Přidat historii konverzace
    if (params.conversationHistory) {
      for (const msg of params.conversationHistory) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }
    
    // Přidat aktuální zprávu
    contents.push({
      role: 'user',
      parts: [{ text: params.message }]
    });

    console.log('Calling Gemini API for chat...');
    
    // Vložíme system prompt jako první user message
    const allContents = [
      {
        role: 'user',
        parts: [{ text: `[Instrukce pro AI učitele]\n${systemPrompt}\n\n[Konec instrukcí]` }]
      },
      {
        role: 'model',
        parts: [{ text: 'Rozumím, budu se řídit těmito instrukcemi jako AI učitel.' }]
      },
      ...contents
    ];
    
    const requestBody = {
      contents: allContents,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.8,
      }
    };
    
    console.log('Gemini API request being sent...');
    
    // Používáme gemini-2.0-flash-exp - velmi chytrý a rychlý model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getGeminiApiKey()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Gemini Response status:', response.status);

    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorData.error?.status || '';
      } catch { errorMessage = responseText.substring(0, 200); }
      console.error('Gemini API error:', response.status, errorMessage);
      throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
    }

    const data = JSON.parse(responseText);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('No text in response:', data);
      throw new Error('Empty response from Gemini');
    }
    
    console.log('Gemini chat response received successfully');
    return text;
  } catch (error: any) {
    console.error('Simple chat error:', error);
    
    // Parse specific error types for better feedback
    if (error?.message?.includes('429') || error?.message?.includes('RATE_LIMIT')) {
      return '❌ Překročen limit Gemini API. Počkej chvíli a zkus to znovu.';
    } else if (error?.message?.includes('403') || error?.message?.includes('PERMISSION_DENIED')) {
      return '❌ Gemini API klíč nemá oprávnění.';
    } else if (error?.message?.includes('quota') || error?.message?.includes('QUOTA')) {
      return '❌ Vyčerpána kvóta Gemini API.';
    }
    
    return 'Omlouvám se, něco se pokazilo. Zkus to prosím znovu. 🙏';
  }
}

