import { BarChart2, Copy, Edit3, ExternalLink, Printer, Share2 } from 'lucide-react';

interface BoardViewDefaultPanelProps {
  title: string;
  canDirectEdit: boolean;
  onOpenStudentOptions: () => void;
  onEdit: () => void;
  onCopyAndEdit: () => void;
  onResults: () => void;
  onPrint: () => void;
  onOpenShareEditDialog: () => void;
}

export function BoardViewDefaultPanel({
  title,
  canDirectEdit,
  onOpenStudentOptions,
  onEdit,
  onCopyAndEdit,
  onResults,
  onPrint,
  onOpenShareEditDialog,
}: BoardViewDefaultPanelProps) {
  return (
    <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
      <div className="border-b border-white/10 flex-shrink-0" style={{ padding: '52px 16px 12px 16px', minWidth: 0 }}>
        <span className="text-xs text-slate-400 uppercase tracking-wide block">Procvičování</span>
        <h2 className="text-base font-bold text-white truncate mt-0.5">{title}</h2>
      </div>

      <div className="flex-1 p-4 flex flex-col">
        <button
          onClick={onOpenStudentOptions}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-xl font-semibold hover:opacity-90 transition-colors mb-3"
          style={{ backgroundColor: '#4eebc0', color: '#4E5871' }}
        >
          <div className="w-[60px] h-[50px] flex items-center justify-center flex-shrink-0">
            <svg width="85" height="65" viewBox="0 0 85 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M51.0455 35.4382C51.0455 35.1613 51.0455 34.8844 50.9716 34.6075H62.6008C64.4098 34.6075 65.8681 33.1123 65.8681 31.2664V8.3588C65.8681 6.51289 64.4098 5.01771 62.6008 5.01771H27.3995C25.5905 5.01771 24.1322 6.51289 24.1322 8.3588V19.4527C22.7109 18.0682 21.8064 17.5329 20.6988 17.0715C20.625 17.0345 20.5881 16.9792 20.4958 16.9422L19.4067 16.5915C19.4067 16.5915 19.3513 16.5915 19.3144 16.5546L18.9637 16.4438C19.1298 16.2777 19.3144 16.13 19.4621 15.9455C21.1418 13.915 21.9171 11.3492 21.6772 8.74644C21.1234 3.41178 16.3056 -0.501534 10.8971 0.0522363C8.27591 0.329122 5.93161 1.58434 4.25184 3.61483C2.57207 5.64532 1.79679 8.21112 2.03676 10.8138C2.20289 12.6044 2.90433 14.2472 3.93804 15.6501L2.46132 16.1116C1.77833 16.3146 1.13227 16.5915 0.523121 16.9422C0.043186 17.2191 -0.141404 17.8283 0.117022 18.3267C0.301612 18.6774 0.633875 18.862 1.00306 18.862C1.16919 18.862 1.31686 18.8066 1.48299 18.7328C1.96292 18.4559 2.49824 18.2344 3.05201 18.0682L5.4886 17.3114C5.4886 17.3114 5.56243 17.3853 5.58089 17.4222C7.35296 18.8435 9.51266 19.6003 11.7462 19.6003C12.0785 19.6003 12.4292 19.6003 12.7799 19.545C14.3305 19.3973 15.7518 18.8435 17.0255 18.0498L18.7791 18.6036C18.9083 18.6589 19.056 18.7143 19.1852 18.7328C21.0865 19.3788 21.8064 19.6188 26.1996 24.7873C27.0487 25.7657 27.8425 26.6332 28.6731 27.5377C30.0945 29.0698 31.5527 30.6573 33.5094 33.1308C33.694 33.3708 33.9893 33.5184 34.3031 33.5184H47.1137C47.6675 33.5184 48.1659 33.74 48.535 34.1276C48.8488 34.4783 49.015 34.9213 49.015 35.4013C49.015 36.3242 48.092 37.2656 47.0214 37.4318L31.645 38.0963C31.1282 38.0963 30.5929 37.9486 30.1683 37.6348L21.7141 31.4141C21.5849 31.3587 21.4372 31.3034 21.2711 31.3034C20.7727 31.3034 20.3666 31.7095 20.3666 32.2079C20.3666 32.2817 20.385 32.3555 20.4219 32.4478L20.7173 43.6709C20.7173 43.6709 20.7173 43.8001 20.7542 43.874L21.6956 47.898C21.7879 48.3595 22.194 48.7102 22.6739 48.7102C23.2462 48.7102 23.7077 48.2487 23.7077 47.6765C23.7077 47.5104 23.6523 47.3627 23.5784 47.215L22.7109 43.4863L22.4709 34.0722L28.9685 39.2592C28.9685 39.2592 29.0054 39.2592 29.0054 39.2961C29.7807 39.8683 30.7036 40.1637 31.7004 40.1637L47.1691 39.4992H47.2614C49.3103 39.1854 50.9716 37.4133 51.027 35.4751L51.0455 35.4382ZM17.8746 14.6718C16.5456 16.2962 14.6627 17.293 12.5584 17.5145H12.5953C10.5095 17.6991 8.4605 17.1268 6.85457 15.7978C5.24863 14.4872 4.23338 12.6413 4.04879 10.6108C3.84574 8.56185 4.47335 6.54981 5.78394 4.94388C7.11299 3.31948 8.99581 2.3227 11.0817 2.10119C11.3586 2.10119 11.617 2.06427 11.8939 2.06427C15.8626 2.06427 19.2406 5.03617 19.6282 9.00486C19.8313 11.0538 19.2037 13.0658 17.8931 14.6902L17.8746 14.6718ZM44.8432 27.7592C40.5423 27.7592 37.0535 24.1966 37.0535 19.8034C37.0535 15.4101 40.5423 11.8476 44.8432 11.8476C49.1442 11.8476 52.6329 15.4101 52.6329 19.8034C52.6329 24.1966 49.1442 27.7592 44.8432 27.7592Z" fill="#00805B"/>
              <path d="M43.2567 16.349V16.312C42.8322 16.0536 42.2969 16.3859 42.2969 16.8843V23.2342C42.2969 23.7326 42.8137 24.0464 43.2567 23.8064L48.6283 20.6499C49.0529 20.3915 49.0529 19.7639 48.6283 19.5239L43.2567 16.3674V16.349Z" fill="#00805B"/>
              <path d="M35.3018 43.2847C29.4872 43.2847 24.7617 48.0102 24.7617 53.8248C24.7617 59.6394 29.4872 64.3649 35.3018 64.3649C41.1164 64.3649 45.8419 59.6394 45.8419 53.8248C45.8419 48.0102 41.1164 43.2847 35.3018 43.2847ZM35.3018 62.3528C30.6132 62.3528 26.7922 58.5318 26.7922 53.8432C26.7922 49.1546 30.6132 45.3336 35.3018 45.3336C39.9904 45.3336 43.8114 49.1546 43.8114 53.8432C43.8114 58.5318 39.9904 62.3528 35.3018 62.3528Z" fill="#00805B"/>
              <path d="M74.1571 35.8765C68.9332 35.8765 64.5954 39.6975 63.7647 44.6999C62.2141 43.7954 60.4052 43.2785 58.4854 43.2785C52.6708 43.2785 47.9453 48.004 47.9453 53.8186C47.9453 59.6332 52.6708 64.3587 58.4854 64.3587C63.7093 64.3587 68.0472 60.5377 68.8778 55.5353C70.4284 56.4398 72.2374 56.9567 74.1571 56.9567C79.9717 56.9567 84.6972 52.2312 84.6972 46.4166C84.6972 40.602 79.9717 35.8765 74.1571 35.8765ZM69.0071 53.1541C68.8409 50.3853 67.5857 47.8933 65.6844 46.1212C65.8506 41.5618 69.5793 37.907 74.1756 37.907C78.7719 37.907 82.6852 41.728 82.6852 46.4166C82.6852 51.1052 78.8642 54.9262 74.1756 54.9262C72.2374 54.9262 70.4653 54.2432 69.0255 53.1357L69.0071 53.1541ZM66.995 53.8186C66.995 53.9294 66.9766 54.0217 66.9581 54.1324C66.792 58.6918 63.0633 62.3467 58.467 62.3467C53.8707 62.3467 49.9573 58.5257 49.9573 53.8371C49.9573 49.1485 53.7784 45.3275 58.467 45.3275C60.4052 45.3275 62.1772 46.0105 63.617 47.118C64.0416 47.4318 64.4292 47.801 64.7799 48.1886C65.8506 49.3885 66.5889 50.8836 66.8474 52.545C66.9212 52.9695 66.9766 53.4125 66.9766 53.8556L66.995 53.8186Z" fill="#00805B"/>
            </svg>
          </div>
          <span>Připojit studenty</span>
        </button>

        {canDirectEdit ? (
          <button
            onClick={onEdit}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-white font-medium hover:bg-white/20 transition-colors mb-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Edit3 className="w-6 h-6 text-slate-400" />
            <span>Upravit</span>
          </button>
        ) : (
          <button
            onClick={onCopyAndEdit}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl font-medium mb-3"
            style={{ backgroundColor: '#4eebc0', color: '#1e293b' }}
          >
            <Copy className="w-6 h-6" />
            <span>Kopírovat a upravit</span>
          </button>
        )}

        {canDirectEdit && (
          <button
            onClick={onResults}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-white font-medium hover:bg-white/20 transition-colors mb-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <BarChart2 className="w-6 h-6 text-slate-400" />
            <span>Výsledky</span>
          </button>
        )}

        <div className="flex-1" />

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button
            onClick={onPrint}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 font-medium hover:bg-slate-600/50 transition-colors"
            style={{ backgroundColor: 'rgba(71,85,105,0.5)' }}
          >
            <Printer className="w-4 h-4" />
            <span className="text-sm">Tisknout</span>
          </button>
          <button
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 font-medium hover:bg-slate-600/50 transition-colors"
            style={{ backgroundColor: 'rgba(71,85,105,0.5)' }}
          >
            <Share2 className="w-4 h-4" />
            <span className="text-sm">Sdílet</span>
          </button>
        </div>

        <button
          onClick={onOpenShareEditDialog}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 font-medium hover:bg-slate-600/50 transition-colors mt-3"
          style={{ backgroundColor: 'rgba(71,85,105,0.5)' }}
        >
          <ExternalLink className="w-4 h-4" />
          <span className="text-sm">Sdílet odkaz pro úpravu</span>
        </button>
      </div>
    </div>
  );
}
