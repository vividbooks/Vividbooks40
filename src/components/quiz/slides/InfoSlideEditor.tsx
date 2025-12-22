/**
 * Info Slide Editor
 * 
 * Editor for information/content slides
 */

import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Type,
} from 'lucide-react';
import { InfoSlide } from '../../../types/quiz';

interface InfoSlideEditorProps {
  slide: InfoSlide;
  onUpdate: (id: string, updates: Partial<InfoSlide>) => void;
}

export function InfoSlideEditor({ slide, onUpdate }: InfoSlideEditorProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-4">
        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
          <FileText className="w-4 h-4" />
          <span>Informace</span>
        </div>
        <h2 className="text-white font-bold text-lg">Informační slide</h2>
      </div>
      
      {/* Title */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Nadpis
        </label>
        <input
          type="text"
          value={slide.title}
          onChange={(e) => onUpdate(slide.id, { title: e.target.value })}
          placeholder="Nadpis slidu..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xl font-semibold"
        />
      </div>
      
      {/* Content */}
      <div className="p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Obsah
        </label>
        <textarea
          value={slide.content}
          onChange={(e) => onUpdate(slide.id, { content: e.target.value })}
          placeholder="Text obsahu... (můžeš použít HTML a LaTeX)"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
          rows={8}
        />
        
        {/* Media buttons */}
        <div className="mt-4 flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
            <ImageIcon className="w-4 h-4" />
            Obrázek
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
            <Video className="w-4 h-4" />
            Video
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
            <Type className="w-4 h-4" />
            Formátování
          </button>
        </div>
      </div>
      
      {/* Media preview */}
      {slide.media && (
        <div className="px-6 pb-6">
          <div className="rounded-xl bg-slate-100 p-4 flex items-center justify-center min-h-[200px]">
            {slide.media.type === 'image' && (
              <img 
                src={slide.media.url} 
                alt={slide.media.caption || ''} 
                className="max-w-full max-h-[300px] rounded-lg"
              />
            )}
            {slide.media.type === 'video' && (
              <video 
                src={slide.media.url} 
                controls 
                className="max-w-full max-h-[300px] rounded-lg"
              />
            )}
          </div>
          {slide.media.caption && (
            <p className="text-sm text-slate-500 text-center mt-2">
              {slide.media.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default InfoSlideEditor;




