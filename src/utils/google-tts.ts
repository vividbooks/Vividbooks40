/**
 * Google Cloud Text-to-Speech API wrapper
 * 
 * Poskytuje kvalitní české hlasy pro AI učitele.
 * Podporuje Gemini TTS (nové) s fallbackem na Google Cloud TTS (klasické).
 */

import { supabase } from './supabase/client';
import { projectId, publicAnonKey } from './supabase/info';

// Separátní API klíč pro Text-to-Speech (bez omezení)
const API_KEY = 'AIzaSyDGUd-SCLfA6epLp9OcFUs8bJRGONo9QnQ';
const SUPABASE_URL = `https://${projectId}.supabase.co`;

// České hlasy dostupné v Google TTS
export const CZECH_VOICES = {
  female: 'cs-CZ-Wavenet-A', // Ženský hlas - přirozenější
  male: 'cs-CZ-Standard-A',  // Mužský hlas - základní
} as const;

// Gemini TTS hlasy (novější, kvalitnější)
export const GEMINI_VOICES = {
  female: 'Kore',   // Ženský hlas - měkký a teplý
  male: 'Puck',     // Mužský hlas - všestranný
} as const;

interface TTSOptions {
  text: string;
  voice?: keyof typeof CZECH_VOICES;
  speakingRate?: number; // 0.25 - 4.0, default 1.0
  useGeminiTTS?: boolean; // Použít Gemini TTS (nové)
}

let currentAudio: HTMLAudioElement | null = null;
let onTextProgress: ((visibleText: string) => void) | null = null;
let progressInterval: NodeJS.Timeout | null = null;

interface SpeakOptions extends TTSOptions {
  onProgress?: (visibleText: string) => void;
}

/**
 * Zkusí použít Gemini TTS Edge Function
 * Vrací base64 audio data nebo null při chybě
 */
async function tryGeminiTTS(text: string, voice: 'female' | 'male'): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gemini-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
      },
      body: JSON.stringify({
        text,
        voice: GEMINI_VOICES[voice],
        prompt: 'Mluv česky jako přátelský učitel. Mluv přirozeně a srozumitelně.',
        languageCode: 'cs-CZ'
      }),
    });

    const data = await response.json();
    
    if (data.success && data.audioContent) {
      console.log('[TTS] Gemini TTS success');
      return data.audioContent;
    }
    
    console.log('[TTS] Gemini TTS failed:', data.error || 'No audio content');
    console.log('[TTS] Full response:', data);
    return null;
  } catch (error) {
    console.log('[TTS] Gemini TTS error, falling back:', error);
    return null;
  }
}

/**
 * Přečte text nahlas pomocí TTS
 * Zkusí nejdříve Gemini TTS, pak Google Cloud TTS
 * S možností postupného vypisování textu
 */
export async function speak(options: SpeakOptions): Promise<void> {
  // Gemini TTS with Service Account authentication
  const { text, voice = 'female', speakingRate = 0.95, onProgress, useGeminiTTS = true } = options;

  // Zastavit předchozí přehrávání
  stop();
  
  onTextProgress = onProgress || null;

  try {
    let audioContent: string | null = null;
    
    // Zkus Gemini TTS (pokud je povoleno)
    if (useGeminiTTS) {
      audioContent = await tryGeminiTTS(text, voice);
    }
    
    // Fallback na Google Cloud TTS
    if (!audioContent) {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: 'cs-CZ',
              name: CZECH_VOICES[voice],
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate,
              pitch: 0,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Google TTS error:', error);
        fallbackSpeak(text);
        return;
      }

      const data = await response.json();
      audioContent = data.audioContent;
    }

    // Přehrát audio
    if (audioContent) {
      const audioBlob = base64ToBlob(audioContent, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      currentAudio = new Audio(audioUrl);
      
      // Spustit postupné vypisování textu
      if (onTextProgress) {
        startTextProgress(text, currentAudio, speakingRate);
      }
      
      // Čekat až audio dohraje
      await new Promise<void>((resolve) => {
        if (!currentAudio) {
          resolve();
          return;
        }
        
        currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          stopTextProgress();
          // Zobrazit celý text na konci
          if (onTextProgress) {
            onTextProgress(text);
          }
          resolve();
        };
        
        currentAudio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          stopTextProgress();
          resolve();
        };
        
        currentAudio.play().catch(() => {
          resolve();
        });
      });
    }
  } catch (error) {
    console.error('TTS error:', error);
    fallbackSpeak(text);
  }
}

/**
 * Spustí postupné vypisování textu synchronizované s audio
 */
function startTextProgress(fullText: string, audio: HTMLAudioElement, speakingRate: number = 1.0): void {
  if (!onTextProgress) {
    return;
  }
  
  // Rozložíme text na skutečné znaky (včetně emoji)
  const chars = [...fullText];
  const totalChars = chars.length;
  
  // Základní rychlost čtení pro češtinu (znaky za sekundu)
  const BASE_CHARS_PER_SECOND = 15; 
  
  // Upravená rychlost podle nastavení TTS
  const charsPerSecond = BASE_CHARS_PER_SECOND * speakingRate;
  
  const estimatedDuration = (totalChars / charsPerSecond) * 1000; // v ms
  const intervalTime = estimatedDuration / totalChars;
  
  // Minimální interval 20ms, max 100ms
  const adjustedInterval = Math.max(20, Math.min(100, intervalTime));
  
  let currentCharIndex = 1;
  
  // Začít s prvním znakem ihned
  onTextProgress(chars.slice(0, 1).join(''));
  
  progressInterval = setInterval(() => {
    if (currentCharIndex < totalChars) {
      currentCharIndex++;
      const visibleText = chars.slice(0, currentCharIndex).join('');
      if (onTextProgress) {
        onTextProgress(visibleText);
      }
    } else {
      stopTextProgress();
    }
  }, adjustedInterval);
}

/**
 * Zastaví postupné vypisování
 */
function stopTextProgress(): void {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

/**
 * Zastaví přehrávání
 */
export function stop(): void {
  stopTextProgress();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  // Zastavit i Web Speech API fallback
  window.speechSynthesis?.cancel();
  onTextProgress = null;
}

/**
 * Zjistí, zda právě přehrává
 */
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/**
 * Fallback na Web Speech API pokud Google TTS selže
 */
function fallbackSpeak(text: string): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'cs-CZ';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

/**
 * Konverze base64 na Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

