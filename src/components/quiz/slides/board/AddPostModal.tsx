import React, { useState } from 'react';
import { Image as ImageIcon, Youtube, Trash2, X } from 'lucide-react';
import { POST_COLORS, getYouTubeId } from './board-constants';

interface AddPostModalProps {
  allowMedia: boolean;
  showColumnSelector?: boolean;
  leftColumnLabel?: string;
  rightColumnLabel?: string;
  onSubmit: (
    text: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'youtube',
    backgroundColor?: string,
    column?: 'left' | 'right',
  ) => void;
  onClose: () => void;
}

export function AddPostModal({
  allowMedia,
  showColumnSelector,
  leftColumnLabel,
  rightColumnLabel,
  onSubmit,
  onClose,
}: AddPostModalProps) {
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'youtube' | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [selectedColumn, setSelectedColumn] = useState<'left' | 'right'>('left');

  const youtubeId = mediaType === 'youtube' && mediaUrl ? getYouTubeId(mediaUrl) : null;
  const canSubmit = text.trim() || mediaUrl.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(
      text.trim(),
      mediaUrl.trim() || undefined,
      mediaType || undefined,
      backgroundColor,
      showColumnSelector ? selectedColumn : undefined,
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: '600px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <h3 className="font-bold text-slate-800 text-lg">
            {showColumnSelector ? 'Nový argument' : 'Nový příspěvek'}
          </h3>
          <div style={{ width: '40px' }} />
        </div>

        {/* Media upload area */}
        {allowMedia && (
          <div
            className="relative border-2 border-dashed border-slate-200 m-4 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
              minHeight: mediaUrl ? 'auto' : '160px',
            }}
          >
            {mediaUrl && mediaType === 'image' && (
              <div className="relative">
                <img src={mediaUrl} alt="Náhled" className="w-full h-64 object-cover" onError={() => setMediaUrl('')} />
                <button
                  onClick={() => { setMediaUrl(''); setMediaType(null); }}
                  className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}

            {mediaUrl && mediaType === 'youtube' && youtubeId && (
              <div className="relative">
                <div className="w-full h-64">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <button
                  onClick={() => { setMediaUrl(''); setMediaType(null); }}
                  className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}

            {!mediaUrl && (
              <div className="flex items-center justify-center gap-6 py-12">
                <button
                  onClick={() => setMediaType('image')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl hover:bg-white/50 transition-colors group"
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
                  >
                    <ImageIcon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Obrázek</span>
                </button>

                <button
                  onClick={() => setMediaType('youtube')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl hover:bg-white/50 transition-colors group"
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
                  >
                    <Youtube className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">YouTube</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* URL input when media type is selected */}
        {allowMedia && mediaType && !mediaUrl && (
          <div className="px-4 pb-3">
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={mediaType === 'image' ? 'Vlož URL obrázku...' : 'Vlož URL YouTube videa...'}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none text-sm bg-slate-50"
              autoFocus
            />
          </div>
        )}

        {/* Text input */}
        <div className="px-4 pb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={showColumnSelector ? 'Napiš svůj argument...' : 'Napiš něco úžasného... ✨'}
            className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none resize-none text-[#4E5871] bg-slate-50 placeholder:text-slate-400 text-lg"
            rows={4}
            autoFocus={!allowMedia}
          />
        </div>

        {/* Color picker – only for non-column posts */}
        {!showColumnSelector && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-600 mb-3">Barva pozadí</p>
            <div className="flex flex-wrap gap-2">
              {POST_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setBackgroundColor(color.value)}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color.value,
                    borderColor: backgroundColor === color.value ? '#ec4899' : '#e2e8f0',
                    boxShadow: backgroundColor === color.value ? '0 0 0 2px rgba(236, 72, 153, 0.3)' : 'none',
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Column selector and Submit */}
        <div className="px-4 pb-5 border-t border-slate-100 pt-4">
          {showColumnSelector && (
            <div className="flex-1 mb-4">
              <label className="block text-sm font-medium text-slate-600 mb-2">Kam odeslat?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedColumn('left')}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all border-2"
                  style={{
                    backgroundColor: selectedColumn === 'left' ? 'rgba(34, 197, 94, 0.1)' : '#ffffff',
                    borderColor: selectedColumn === 'left' ? '#22c55e' : '#e2e8f0',
                    color: selectedColumn === 'left' ? '#15803d' : '#64748b',
                  }}
                >
                  <span className="mr-2">+</span>
                  {leftColumnLabel || 'Pro'}
                </button>
                <button
                  onClick={() => setSelectedColumn('right')}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all border-2"
                  style={{
                    backgroundColor: selectedColumn === 'right' ? 'rgba(239, 68, 68, 0.1)' : '#ffffff',
                    borderColor: selectedColumn === 'right' ? '#ef4444' : '#e2e8f0',
                    color: selectedColumn === 'right' ? '#b91c1c' : '#64748b',
                  }}
                >
                  <span className="mr-2">−</span>
                  {rightColumnLabel || 'Proti'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2"
            style={{
              background: canSubmit
                ? showColumnSelector
                  ? selectedColumn === 'left'
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'linear-gradient(to right, #ec4899, #f43f5e)'
                : '#f1f5f9',
              color: canSubmit ? 'white' : '#94a3b8',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            Odeslat
            {showColumnSelector && (
              <span className="opacity-80">
                → {selectedColumn === 'left' ? leftColumnLabel || 'Pro' : rightColumnLabel || 'Proti'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
