/**
 * TeachMeChat - AI Chat komponenta pro tutoring
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, GraduationCap, X, BookOpen, Sparkles, RefreshCw, Volume2, VolumeX, ChevronDown, Key } from 'lucide-react';
import { chatWithRAG, simpleChatWithAI, isGeminiConfigured } from '../../utils/gemini-rag';
import { chatWithOpenAI, setOpenAIKey, getOpenAIKey } from '../../utils/openai-chat';
import { speak as googleSpeak, stop as stopSpeaking, isSpeaking } from '../../utils/google-tts';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAnalytics } from '../../hooks/useAnalytics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ source: string; content: string }>;
  timestamp: Date;
}

interface TeachMeChatProps {
  documentId?: string;
  ragDocumentId?: string | null;
  documentTitle: string;
  documentContent?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  onClose: () => void;
  mode?: 'modal' | 'panel';
}

const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash ⚡' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-5', label: 'GPT-5' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }
] as const;

type ModelType = typeof MODELS[number]['id'];

// Barvy pro rychlé odpovědi
const QUICK_RESPONSE_COLORS = [
  'bg-emerald-500 hover:bg-emerald-600', // zelená
  'bg-blue-500 hover:bg-blue-600',       // modrá  
  'bg-amber-500 hover:bg-amber-600',     // oranžová
  'bg-purple-500 hover:bg-purple-600',   // fialová
];

// Extrakce možností z textu AI - hledá formát [[A) text]]
function extractOptionsFromText(text: string): { cleanText: string; options: string[] } {
  const optionRegex = /\[\[([A-Z]\))\s*([^\]]+)\]\]/g;
  const options: string[] = [];
  let match;
  
  while ((match = optionRegex.exec(text)) !== null) {
    options.push(match[2].trim());
  }
  
  // Odstranit možnosti z textu pro čisté zobrazení
  const cleanText = text.replace(optionRegex, '').trim();
  
  return { cleanText, options };
}

export function TeachMeChat({ 
  documentId, 
  ragDocumentId,
  documentTitle, 
  documentContent,
  subject = 'obecné',
  grade = '6', 
  topic,
  onClose,
  mode
}: TeachMeChatProps) {
  const displayTopic = topic || documentTitle;
  const isConfigured = isGeminiConfigured();
  const { trackEvent } = useAnalytics();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speakingText, setSpeakingText] = useState<string | null>(null); // Text který se postupně vypisuje (null = nezobrazovat)
  const [voiceEnabled, setVoiceEnabled] = useState(true); // Mluvení zapnuto v základu
  const [selectedModel, setSelectedModel] = useState<ModelType | null>(null); // null = ještě nevybráno
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string>(''); // Prázdný = přečte i welcome zprávu
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Funkce pro výběr modelu a start chatu
  const handleModelSelect = (modelId: ModelType) => {
    setSelectedModel(modelId);
    
    // Track usage
    trackEvent('ai_teach_me_used', 'ai', {
      model: modelId,
      topic: displayTopic,
      documentId: documentId || ragDocumentId
    });

    // Přidat welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Ahoj! 👋 Jsem tvůj AI učitel a společně se podíváme na téma "${displayTopic}".

Začneme jednoduše - řekni mi, co už o tomto tématu víš? Nebo se můžeš rovnou zeptat na cokoliv, čemu nerozumíš. 😊`,
      timestamp: new Date()
    }]);
  };

  // Text-to-Speech funkce (Google Cloud TTS) s postupným vypisováním
  const speak = useCallback(async (text: string, messageId: string) => {
    // TTS jen pro Gemini (Google) nebo pokud je to žádané i jinde (ale momentálně využíváme Google TTS)
    // Uživatel psal: "TTS bude jen pro geminy, pokud by to bylo problematické"
    // Pokud je vybrán jiný model, TTS možná nebudeme chtít? Ale Google TTS je samostatná služba.
    // Zkusíme to nechat pro všechny, pokud to uživatel explicitně nevypne.
    // Pokud uživatel chce jen pro Gemini, můžeme přidat podmínku:
    // if (selectedModel !== 'gemini') return;
    
    // Prozatím necháme pro všechny, protože Google TTS API key máme nastavený nezávisle na modelu chatu.
    
    console.log('TTS: speak called for message:', messageId);
    
    // Zastavit předchozí čtení
    stopSpeaking();
    
    if (speakingId === messageId) {
      // Pokud už čteme tuto zprávu, zastavíme
      setSpeakingId(null);
      setSpeakingText(null);
      return;
    }

    setSpeakingId(messageId);
    setSpeakingText(''); // Prázdný string = začínáme vypisovat
    
    try {
      await googleSpeak({ 
        text, 
        voice: 'female', 
        speakingRate: 1.15,
        onProgress: (visibleText) => {
          // console.log('TTS progress len:', visibleText.length, '/', text.length);
          setSpeakingText(visibleText);
        }
      });
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setSpeakingId(null);
      setSpeakingText(null);
    }
  }, [speakingId, selectedModel]);

  // Vypnout/zapnout mluvení
  const toggleVoice = useCallback(() => {
    if (voiceEnabled) {
      // Vypínáme - zastavit mluvení
      stopSpeaking();
      setSpeakingId(null);
      setSpeakingText(null);
    }
    setVoiceEnabled(!voiceEnabled);
  }, [voiceEnabled]);

  // Automaticky spustit mluvení při nové AI zprávě
  useEffect(() => {
    // Pokud je vybrán jiný model než Gemini a uživatel chtěl TTS jen pro Gemini
    // Ale Google TTS je nezávislý. Necháme to na voiceEnabled.
    // Pokud by to dělalo problémy (např. latence OpenAI + TTS), můžeme to omezit.
    if (!voiceEnabled) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessage.id;
      // Malé zpoždění aby se zpráva zobrazila
      setTimeout(() => {
        speak(lastMessage.content, lastMessage.id);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceEnabled]); // Záměrně vynecháváme speak

  // Zastavit čtení při unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Auto-scroll na konec zpráv
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus na input při otevření
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Zavřít dropdown při kliknutí mimo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent, customMessage?: string) => {
    e?.preventDefault();
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let aiResponseText = '';
      let citations: any[] = [];

      if (selectedModel === 'gemini-2.5-flash') {
        // Použití Gemini s RAG (pokud je dostupné) nebo Simple Chat
        if (ragDocumentId && isConfigured) {
          const response = await chatWithRAG({
            message: messageText,
            ragDocumentId,
            history: messages.map(m => ({ role: m.role, content: m.content })),
            topic: displayTopic,
            grade
          });
          aiResponseText = response.response;
          citations = response.citations || [];
        } else {
          aiResponseText = await simpleChatWithAI({
            message: messageText,
            topic: displayTopic,
            grade,
            history: messages.map(m => ({ role: m.role, content: m.content }))
          });
        }
      } else {
        // Použití OpenAI (GPT-4o mini nebo GPT-4.1 mini)
        // Musíme poslat kontext (documentContent) v system promptu, protože nemáme RAG pro OpenAI
        const systemPrompt = `Jsi přátelský učitel. Piš VELMI KRÁTCE - max 2 věty!
TÉMA: "${displayTopic}"

${documentContent ? `MÁŠ LEKCI - používej její obsah:
${documentContent.substring(0, 15000)}
` : ''}

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

Odpovídej česky! 😊`;

        aiResponseText = await chatWithOpenAI({
          message: messageText,
          model: selectedModel,
          systemPrompt: systemPrompt,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        });
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponseText,
        citations,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Track message
      trackEvent('ai_chat_message', 'ai', {
        role: 'assistant',
        model: selectedModel,
        hasCitations: citations.length > 0,
        length: aiResponseText.length
      });

    } catch (error: any) {
      console.error('Chat error:', error);
      
      // Use specific error message if available, otherwise generic message
      const errorContent = error?.message && !error.message.includes('fetch') 
        ? `❌ ${error.message}`
        : 'Omlouvám se, došlo k chybě při komunikaci s AI. Zkus to prosím znovu.';
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Focus zpět na input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, messages, ragDocumentId, displayTopic, grade, isConfigured, selectedModel, documentContent]);

  // Zobrazujeme panel mode
  if (mode === 'panel') {
    // Rozcestník - výběr modelu na začátku
    if (selectedModel === null) {
      return (
        <div className="flex flex-col h-full bg-[#1e1b4b] text-white">
          {/* Hlavička */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              <h2 className="font-bold text-lg">AI Učitel</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                variant="ghost"
                className={`h-8 px-2 ${showApiKeyInput ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-300'}`}
                title="Nastavení API klíče"
              >
                <Key className="w-4 h-4" />
              </Button>
              <Button 
                onClick={onClose}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-8 px-3 text-sm"
              >
                Zavřít
              </Button>
            </div>
          </div>

          {/* API Key Input Panel */}
          {showApiKeyInput && (
            <div className="p-4 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium">OpenAI API Klíč</span>
                {getOpenAIKey() && (
                  <span className="text-xs text-green-400 ml-2">✓ Nastaven</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-proj-..."
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                />
                <Button
                  onClick={() => {
                    if (apiKeyInput.trim()) {
                      setOpenAIKey(apiKeyInput.trim());
                      setApiKeyInput('');
                      setShowApiKeyInput(false);
                    }
                  }}
                  disabled={!apiKeyInput.trim()}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-10 px-4 text-sm disabled:opacity-50"
                >
                  Uložit
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Klíč se uloží do prohlížeče a bude použit pro OpenAI modely (GPT-5, GPT-4).
              </p>
            </div>
          )}

          {/* Rozcestník */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <GraduationCap className="w-16 h-16 text-yellow-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Vyber si AI učitele</h3>
            <p className="text-gray-400 text-sm text-center mb-8 max-w-xs">
              Téma: <span className="text-white font-medium">{displayTopic}</span>
            </p>

            <div className="space-y-3 w-full max-w-xs">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelSelect(m.id)}
                  className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400/50 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white group-hover:text-yellow-400 transition-colors">
                        {m.label}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {m.id === 'gemini-2.5-flash' && 'Google AI - rychlý a chytrý'}
                        {m.id === 'gpt-4o-mini' && 'OpenAI - rychlý a spolehlivý'}
                        {m.id === 'gpt-5' && 'OpenAI - GPT‑5'}
                        {m.id === 'gpt-5-mini' && 'OpenAI - GPT‑5 mini'}
                        {m.id === 'gpt-4.1-mini' && 'OpenAI - nejnovější verze'}
                      </div>
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-500 -rotate-90 group-hover:text-yellow-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Chat po výběru modelu
    return (
      <div className="flex flex-col h-full bg-[#1e1b4b] text-white">
        {/* Hlavička */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <h2 className="font-bold text-lg">AI Učitel</h2>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Výběr modelu - vlastní dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-1 h-8 px-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                {MODELS.find(m => m.id === selectedModel)?.label}
                <ChevronDown className={`w-3 h-3 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showModelDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-[#2d2a5d] border border-white/20 rounded-lg shadow-xl z-[100] min-w-[160px] py-1">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                        selectedModel === m.id ? 'bg-white/20 text-yellow-400' : 'text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Přepínač hlasu */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleVoice}
              className={`h-8 px-2 gap-2 text-xs font-medium ${voiceEnabled ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' : 'text-gray-400 hover:text-gray-300'}`}
              title={voiceEnabled ? "Vypnout hlas" : "Zapnout hlas"}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {voiceEnabled ? "ON" : "OFF"}
            </Button>

            <Button 
              onClick={onClose}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-8 px-3 text-sm ml-2"
            >
              Zavřít
            </Button>
          </div>
        </div>

        {/* Seznam zpráv */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => {
            const isSpeakingThis = speakingId === message.id;
            const showProgressiveText = voiceEnabled && isSpeakingThis && speakingText !== null;
            
            // Extrahovat možnosti z textu AI
            const { cleanText, options: extractedOptions } = extractOptionsFromText(message.content);
            
            // Pro zobrazení použít čistý text (bez možností v [[...]])
            const textToShow = showProgressiveText ? speakingText : cleanText;
            
            // Možnosti zobrazíme JEN u poslední zprávy a JEN když AI domluvil
            const isLastMessage = message.id === messages[messages.length - 1].id;
            const isFinishedSpeaking = !speakingId;
            const showOptions = isLastMessage && isFinishedSpeaking && message.role === 'assistant';
            
            // Použít JEN extrahované možnosti (žádný fallback)
            const options = extractedOptions;

            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white/10 text-white rounded-bl-none'
                  }`}
                >
                  <div className="text-[16px] leading-relaxed whitespace-pre-wrap">
                    {textToShow}
                    {showProgressiveText && <span className="inline-block w-2 h-4 ml-1 align-middle bg-yellow-400 animate-pulse"/>}
                  </div>
                  
                  {/* Možnosti jako tlačítka - zobrazit pod zprávou */}
                  {showOptions && options && options.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
                      {options.map((option, idx) => (
                        <Button
                          key={idx}
                          variant="secondary"
                          size="sm"
                          className={`${QUICK_RESPONSE_COLORS[idx % QUICK_RESPONSE_COLORS.length]} text-white border-none hover:scale-105 transition-transform text-sm`}
                          onClick={(e) => handleSubmit(e, option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {/* Citace (jen pro Gemini RAG) */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-xs text-gray-400">
                      <div className="font-semibold mb-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Získáno z lekce:
                      </div>
                      {message.citations.map((cit, i) => (
                        <div key={i} className="pl-2 border-l-2 border-yellow-500/50 italic">
                          "{cit.content.substring(0, 80)}..."
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ikona reproduktoru pro manuální přečtení */}
                  {message.role === 'assistant' && !isSpeakingThis && (
                    <button 
                      onClick={() => speak(cleanText, message.id)}
                      className="mt-2 text-gray-500 hover:text-white transition-colors"
                      title="Přečíst nahlas"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Načítání */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                <span className="text-sm text-gray-300">Přemýšlím...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input oblast */}
        <div className="p-4 border-t border-white/10 bg-[#1e1b4b] shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Zeptej se AI učitele..."
              className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-yellow-500/50"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 bg-yellow-500 hover:bg-yellow-600 text-black shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Fallback pro modal mode (pokud by byl použit jinde, zatím neaktualizujeme)
  return null; 
}
