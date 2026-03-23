/**
 * Flashcard Slide Editor
 *
 * Two modes:
 *  - language: word (EN), phonetic, translation (CZ), example sentence + translation, accent
 *  - general:  term (přední strana), answer/description (zadní strana)
 * Both modes: image (shown on FRONT), card color.
 */

import React, { useState } from 'react';
import { Trash2, Sparkles, Languages, BookOpen } from 'lucide-react';
import { FlashcardActivitySlide } from '../../../types/quiz';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';

interface FlashcardSlideEditorProps {
  slide: FlashcardActivitySlide;
  onUpdate: (id: string, updates: Partial<FlashcardActivitySlide>) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400 text-xs">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none transition-all text-sm';

const CARD_COLORS = [
  { color: '#6366f1', label: 'Indigo' },
  { color: '#3b82f6', label: 'Modrá' },
  { color: '#0ea5e9', label: 'Azurová' },
  { color: '#10b981', label: 'Zelená' },
  { color: '#f59e0b', label: 'Žlutá' },
  { color: '#ef4444', label: 'Červená' },
  { color: '#ec4899', label: 'Růžová' },
  { color: '#8b5cf6', label: 'Fialová' },
  { color: '#64748b', label: 'Šedá' },
  { color: '#1e293b', label: 'Tmavá' },
];

export function FlashcardSlideEditor({ slide, onUpdate }: FlashcardSlideEditorProps) {
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  const mode = slide.mode ?? 'language';
  const isLanguage = mode === 'language';
  const set = (updates: Partial<FlashcardActivitySlide>) => onUpdate(slide.id, updates);

  const handleAssetSelect = (result: AssetPickerResult) => {
    set({ image: result.url });
    setShowAssetPicker(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-white">
      {/* Header */}
      <div className="p-4 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-2 text-sm text-indigo-600 mb-1">
          <span>🗂️</span>
          <span className="font-medium">Kartička (Flashcard)</span>
          <span className="ml-auto text-xs bg-indigo-100 text-indigo-500 px-2 py-0.5 rounded-full">
            Nehodnotitelná
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Studenti otočí kartičku a ohodnotí sami sebe: Znám / Neznám.
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* ── Mode toggle ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Typ kartičky</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => set({ mode: 'language' })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                isLanguage
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <Languages className="w-4 h-4 flex-shrink-0" />
              <div>
                <div>Jazyky</div>
                <div className={`text-xs ${isLanguage ? 'text-indigo-200' : 'text-slate-400'}`}>
                  AJ, NJ, FJ — fonetika + věty
                </div>
              </div>
            </button>
            <button
              onClick={() => set({ mode: 'general' })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                !isLanguage
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              <div>
                <div>Obecné</div>
                <div className={`text-xs ${!isLanguage ? 'text-indigo-200' : 'text-slate-400'}`}>
                  Přírodopis, dějepis…
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* ── Front side ──────────────────────────────────────── */}
        <Field
          label={isLanguage ? 'Slovo / fráze (anglicky)' : 'Pojem / otázka'}
          hint="přední strana *"
        >
          <input
            type="text"
            value={slide.word}
            onChange={(e) => set({ word: e.target.value })}
            placeholder={isLanguage ? 'portion' : 'Fotosyntéza'}
            className={inputCls}
          />
        </Field>

        {/* Phonetic — language only */}
        {isLanguage && (
          <Field label="Výslovnost (fonetika)" hint="volitelné">
            <input
              type="text"
              value={slide.phonetic || ''}
              onChange={(e) => set({ phonetic: e.target.value })}
              placeholder="/pɔːʃ.ən/"
              className={`${inputCls} font-mono`}
            />
          </Field>
        )}

        {/* Image on FRONT */}
        <Field
          label="Obrázek"
          hint="přední strana — volitelné"
        >
          {slide.image ? (
            <div className="space-y-2">
              <div className="relative inline-block w-full">
                <img
                  src={slide.image}
                  alt={slide.word}
                  className="max-h-28 w-full object-cover rounded-xl border border-slate-200"
                />
                <button
                  onClick={() => set({ image: undefined, frontImageOnly: false })}
                  className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Odebrat obrázek"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Front image-only toggle */}
              <button
                onClick={() => set({ frontImageOnly: !slide.frontImageOnly })}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  slide.frontImageOnly
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <span className="text-base">{slide.frontImageOnly ? '🖼️' : '🖼️'}</span>
                <div className="text-left">
                  <div>Pouze obrázek vpředu</div>
                  <div className={`text-xs ${slide.frontImageOnly ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {slide.frontImageOnly
                      ? 'Přední strana: jen obrázek. Slovo + překlad na zadní straně.'
                      : 'Přední strana: obrázek vlevo + text vpravo.'}
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAssetPicker(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm w-full"
            >
              <Sparkles className="w-4 h-4" />
              Vybrat obrázek
            </button>
          )}
        </Field>

        <div className="border-t border-slate-100" />

        {/* ── Back side ───────────────────────────────────────── */}
        <Field
          label={isLanguage ? 'Překlad (česky)' : 'Odpověď / popis'}
          hint="zadní strana *"
        >
          {isLanguage ? (
            <input
              type="text"
              value={slide.translation}
              onChange={(e) => set({ translation: e.target.value })}
              placeholder="porce"
              className={inputCls}
            />
          ) : (
            <textarea
              value={slide.translation}
              onChange={(e) => set({ translation: e.target.value })}
              placeholder="Proces přeměny světelné energie na chemickou energii v rostlinách pomocí chlorofylu."
              className={`${inputCls} resize-none`}
              rows={3}
            />
          )}
        </Field>

        {/* Example sentence + translation — language only */}
        {isLanguage && (
          <>
            <Field label="Příkladová věta (anglicky)" hint="volitelné">
              <input
                type="text"
                value={slide.exampleSentence || ''}
                onChange={(e) => set({ exampleSentence: e.target.value })}
                placeholder="I'd like a large portion of chips, please."
                className={inputCls}
              />
            </Field>
            <Field label="Překlad věty (česky)" hint="volitelné">
              <input
                type="text"
                value={slide.exampleTranslation || ''}
                onChange={(e) => set({ exampleTranslation: e.target.value })}
                placeholder="Prosím velkou porci hranolků."
                className={inputCls}
              />
            </Field>
          </>
        )}

        <div className="border-t border-slate-100" />

        {/* ── Card color ──────────────────────────────────────── */}
        <Field label="Barva kartičky">
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS.map(({ color, label }) => (
              <button
                key={color}
                onClick={() => set({ cardColor: color })}
                title={label}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: color,
                  borderColor:
                    (slide.cardColor ?? '#6366f1') === color ? '#1e293b' : 'transparent',
                  transform: (slide.cardColor ?? '#6366f1') === color ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </Field>

        {/* Accent — language only */}
        {isLanguage && (
          <Field label="Přízvuk">
            <div className="flex gap-2">
              {(['en-US', 'en-GB'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => set({ audioLang: lang })}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                    (slide.audioLang ?? 'en-US') === lang
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {lang === 'en-US' ? '🇺🇸 Americký' : '🇬🇧 Britský'}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>

      <AssetPicker
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        onSelect={handleAssetSelect}
        showUpload={true}
        showLibrary={true}
        showGiphy={true}
        showGoogle={true}
        showVividbooks={true}
        defaultTab="google"
      />
    </div>
  );
}

export default FlashcardSlideEditor;
