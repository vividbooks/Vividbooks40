import { ArrowLeft, Crosshair, Swords } from 'lucide-react';

interface BoardViewCompetitionPickerPanelProps {
  onClose: () => void;
  onStartCompetition: () => void;
  onStartTeamCompetition: () => void;
  onStartDuelCompetition: () => void;
  onStartTacticalCompetition: () => void;
}

export function BoardViewCompetitionPickerPanel({
  onClose,
  onStartCompetition,
  onStartTeamCompetition,
  onStartDuelCompetition,
  onStartTacticalCompetition,
}: BoardViewCompetitionPickerPanelProps) {
  return (
    <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
      <div className="p-6">
        <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white mb-4">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-white text-center leading-snug">Vyberte soutěžní mód:</h2>
      </div>

      <div className="flex-1 px-5">
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={onStartCompetition}
            className="flex items-center gap-4 p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: '#4eebc0' }}
          >
            <div className="w-12 h-[62px] flex items-center justify-center flex-shrink-0">
              <svg width="55" height="70" viewBox="0 0 55 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path d="M14.5342 43.2969H40.4902C42.8692 43.2971 44.8236 45.1818 44.9434 47.5664L44.9492 47.7988L44.9453 63.6348C44.9453 66.1282 42.9412 68.1367 40.4854 68.1367H14.5303C12.0747 68.1367 10.0707 66.1289 10.0703 63.6357L10.0752 47.7988C10.0752 45.3055 12.0785 43.297 14.5342 43.2969Z" stroke="#4E5871" strokeWidth="2"/>
                <path d="M9.46142 18.3344L16.3517 25.0471C16.8189 25.4849 17.0232 26.1269 16.9064 26.769L15.2715 36.2543C15.0087 37.8303 16.6729 39.0561 18.1035 38.2973L26.6288 33.8319C27.1835 33.5401 27.8842 33.5401 28.4389 33.8319L36.9642 38.2973C38.3948 39.0561 40.059 37.8303 39.7962 36.2543L38.1613 26.769C38.0445 26.1269 38.2489 25.4849 38.716 25.0471L45.6063 18.3344C46.7741 17.1962 46.1318 15.2408 44.526 15.0073L35.0081 13.6356C34.3658 13.548 33.8402 13.1394 33.5483 12.5849L29.2856 3.94602C28.5849 2.48674 26.512 2.48674 25.8113 3.94602L21.5486 12.5849C21.2567 13.1686 20.7311 13.548 20.0888 13.6356L10.5709 15.0073C8.96509 15.2408 8.35197 17.1962 9.49062 18.3344H9.46142Z" fill="#4E5871"/>
                <path d="M1.3151 33.3085C1.51948 33.3085 1.69465 33.2793 1.89903 33.1918L12.0009 28.347C12.6724 28.026 12.9352 27.238 12.6432 26.5667C12.3221 25.8954 11.5338 25.6036 10.8623 25.9538L0.760374 30.7986C0.0888615 31.1196 -0.173905 31.9076 0.118057 32.5789C0.351626 33.0459 0.818768 33.3377 1.3151 33.3377V33.3085Z" fill="#4E5871"/>
                <path d="M6.83744 2.48839L16.6474 8.17955C16.8517 8.29629 17.0853 8.35466 17.3189 8.35466C17.786 8.35466 18.224 8.12118 18.4867 7.68339C18.8663 7.04132 18.6327 6.22412 17.9904 5.8739L8.18047 0.182737C7.53815 -0.196674 6.72066 0.0368099 6.3703 0.67889C5.99075 1.32097 6.22432 2.13816 6.86664 2.48839H6.83744Z" fill="#4E5871"/>
                <path d="M41.7167 26.5663C41.3955 27.2376 41.6875 28.0256 42.359 28.3467L52.4608 33.1914C52.636 33.279 52.8404 33.3082 53.0448 33.3082C53.5411 33.3082 54.0082 33.0163 54.2418 32.5494C54.563 31.8781 54.271 31.0901 53.5995 30.769L43.4976 25.9243C42.8261 25.6032 42.0378 25.8951 41.7167 26.5372V26.5663Z" fill="#4E5871"/>
                <path d="M37.0819 8.35341C37.3155 8.35341 37.5491 8.29504 37.7534 8.1783L47.5633 2.48714C48.2057 2.10773 48.41 1.29053 48.0597 0.67764C47.6801 0.0355606 46.8626 -0.168737 46.2495 0.181488L36.4396 5.87265C35.7973 6.25206 35.5929 7.06925 35.9433 7.68215C36.1768 8.11993 36.644 8.35341 37.1111 8.35341H37.0819Z" fill="#4E5871"/>
              </svg>
            </div>
            <div className="text-left">
              <span className="text-lg font-bold text-slate-800 block">Soutěž</span>
              <span className="text-sm text-slate-600">Každý sám za sebe</span>
            </div>
          </button>

          <button
            onClick={onStartTeamCompetition}
            className="flex items-center gap-4 p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: '#a78bfa' }}
          >
            <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 64 64" className="w-full h-full">
                <circle cx="20" cy="20" r="8" fill="#fff" opacity="0.8" />
                <circle cx="44" cy="20" r="8" fill="#fff" opacity="0.8" />
                <circle cx="20" cy="44" r="8" fill="#fff" opacity="0.8" />
                <circle cx="44" cy="44" r="8" fill="#fff" opacity="0.8" />
              </svg>
            </div>
            <div className="text-left">
              <span className="text-lg font-bold text-white block">Týmová soutěž</span>
              <span className="text-sm text-white/70">Hráči v týmech proti sobě</span>
            </div>
          </button>

          <button
            onClick={onStartDuelCompetition}
            className="flex items-center gap-4 p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: '#FF6B35' }}
          >
            <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
              <Swords className="w-10 h-10" style={{ color: '#fff' }} />
            </div>
            <div className="text-left">
              <span className="text-lg font-bold text-white block">Duely</span>
              <span className="text-sm text-white/70">1 vs 1 souboje ve dvojicích</span>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
