/**
 * Tiny Web Audio API sound effects — no external files needed.
 */

function getAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

/** Pleasant two-note ascending chime — played on successful generation. */
export function playSuccessSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Two-note ascending ding: A5 → C#6
  const notes = [
    { freq: 880, start: 0, duration: 0.18 },
    { freq: 1108, start: 0.14, duration: 0.28 },
  ];

  notes.forEach(({ freq, start, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + start);

    // Quick attack, smooth decay
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.22, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  });
}

// ─── TTS (Text-to-Speech) ────────────────────────────────────────────────────

/**
 * Google Cloud TTS voice mapping.
 * Wavenet = natural neural voices (billed, but high quality).
 * Studio voices available for some locales.
 */
const GOOGLE_TTS_VOICES: Record<string, { name: string; ssmlGender: 'FEMALE' | 'MALE' | 'NEUTRAL' }> = {
  'cs-CZ': { name: 'cs-CZ-Wavenet-A', ssmlGender: 'FEMALE' },
  'sk-SK': { name: 'sk-SK-Wavenet-A', ssmlGender: 'FEMALE' },
  'en-US': { name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
  'en-GB': { name: 'en-GB-Wavenet-A', ssmlGender: 'FEMALE' },
  'de-DE': { name: 'de-DE-Wavenet-C', ssmlGender: 'FEMALE' },
};

/** In-memory audio cache: key = `${lang}:${text}`, value = base64 MP3 string */
const _ttsCache = new Map<string, string>();

/** Currently playing HTML audio element (Google TTS path) */
let _currentAudio: HTMLAudioElement | null = null;

/** Currently active Web Speech utterance (fallback path) */
let _ttsUtterance: SpeechSynthesisUtterance | null = null;

/** Strip HTML tags and normalise whitespace for TTS input */
function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Synthesise `text` via Google Cloud TTS (Wavenet voices).
 * Returns a base64-encoded MP3 string.
 * Throws if the API key is missing or the request fails.
 */
async function synthesiseWithGoogle(text: string, lang: string): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_TTS_API_KEY as string | undefined;
  if (!apiKey) throw new Error('VITE_GOOGLE_TTS_API_KEY not set');

  const cacheKey = `${lang}:${text}`;
  const cached = _ttsCache.get(cacheKey);
  if (cached) return cached;

  const voice = GOOGLE_TTS_VOICES[lang] ?? GOOGLE_TTS_VOICES['cs-CZ'];

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: lang, name: voice.name, ssmlGender: voice.ssmlGender },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9,
          pitch: 0,
          effectsProfileId: ['headphone-class-device'],
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google TTS error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data: { audioContent?: string } = await res.json();
  if (!data.audioContent) throw new Error('Google TTS: empty audioContent');

  _ttsCache.set(cacheKey, data.audioContent);
  return data.audioContent;
}

/** Play base64-encoded MP3 and call `onEnd` when done. */
function playBase64Audio(base64: string, onEnd?: () => void): HTMLAudioElement {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.onended = onEnd ?? null;
  audio.play().catch(console.error);
  return audio;
}

/** Fallback: browser Web Speech API */
function speakWithWebSpeech(text: string, lang: string, onEnd?: () => void): void {
  if (!window.speechSynthesis) return;
  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  if (onEnd) utterance.onend = onEnd;

  _ttsUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

/**
 * Speak `text` using Google Cloud TTS (Wavenet).
 * Falls back to the browser Web Speech API when the API key is not configured.
 *
 * @returns Promise that resolves once playback has *started* (not ended).
 */
export async function speakText(
  text: string,
  lang = 'cs-CZ',
  onEnd?: () => void
): Promise<void> {
  const plain = plainText(text);
  if (!plain) return;

  stopSpeech();

  try {
    const base64 = await synthesiseWithGoogle(plain, lang);
    _currentAudio = playBase64Audio(base64, onEnd);
  } catch (err) {
    console.warn('[TTS] Google TTS failed, falling back to Web Speech:', err);
    speakWithWebSpeech(plain, lang, onEnd);
  }
}

/** Stop any currently playing TTS (both Google audio and Web Speech). */
export function stopSpeech(): void {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.src = '';
    _currentAudio = null;
  }
  if (window.speechSynthesis?.speaking || window.speechSynthesis?.paused) {
    window.speechSynthesis.cancel();
  }
  _ttsUtterance = null;
}

/**
 * Pause playback.
 * Works for both Google TTS (HTMLAudioElement) and Web Speech API.
 */
export function pauseSpeech(): void {
  if (_currentAudio && !_currentAudio.paused) {
    _currentAudio.pause();
    return;
  }
  if (window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume paused playback.
 */
export function resumeSpeech(): void {
  if (_currentAudio && _currentAudio.paused && !_currentAudio.ended) {
    _currentAudio.play().catch(console.error);
    return;
  }
  if (window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
  }
}

/**
 * Rewind by `seconds` (default 5s).
 * Only works for Google TTS (HTMLAudioElement); no-op for Web Speech.
 */
export function rewindSpeech(seconds = 5): void {
  if (_currentAudio) {
    _currentAudio.currentTime = Math.max(0, _currentAudio.currentTime - seconds);
  }
}

/** Returns true when TTS audio is currently playing (not paused). */
export function isSpeaking(): boolean {
  if (_currentAudio && !_currentAudio.paused && !_currentAudio.ended) return true;
  return window.speechSynthesis?.speaking ?? false;
}

/** Returns true when TTS audio is paused mid-playback. */
export function isTTSPaused(): boolean {
  if (_currentAudio && _currentAudio.paused && !_currentAudio.ended && _currentAudio.currentTime > 0) return true;
  return window.speechSynthesis?.paused ?? false;
}

/** Pre-warm the cache for a block (call on slide pre-load). */
export function prewarmTTS(text: string, lang = 'cs-CZ'): void {
  const plain = plainText(text);
  if (!plain) return;
  const cacheKey = `${lang}:${plain}`;
  if (!_ttsCache.has(cacheKey)) {
    synthesiseWithGoogle(plain, lang).catch(() => { /* silent */ });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Short three-note fanfare — played when a large batch finishes. */
export function playFanfareSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const notes = [
    { freq: 660, start: 0,    duration: 0.15 },
    { freq: 880, start: 0.12, duration: 0.15 },
    { freq: 1100, start: 0.24, duration: 0.35 },
  ];

  notes.forEach(({ freq, start, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + start);

    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.2, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  });
}
