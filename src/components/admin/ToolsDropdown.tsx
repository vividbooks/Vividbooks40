import { useState } from 'react';
import { 
  ChevronDown, 
  Layers, 
  Users, 
  Plus 
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const ToolsDropdown = () => {
  const [open, setOpen] = useState(false);

  const menuItems = [
    { label: 'Můj interaktivní obsah', icon: Layers, action: () => console.log('Interaktivní obsah') },
    { label: 'Moje třída a výsledky', icon: Users, action: () => console.log('Moje třída') },
    { label: 'Vytvořit vlastní pracovní sešit', icon: Plus, action: () => console.log('Vytvořit sešit') }
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`
          flex items-center gap-2 px-4 py-2 bg-[#000048] text-white rounded-full 
          hover:bg-[#000060] transition-all duration-200 shadow-sm group
          ${open ? 'ring-2 ring-blue-200' : ''}
        `}>
          <span className="text-sm font-medium" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
             Digitální učebnice
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <div className="flex flex-col gap-1">
          {menuItems.map((item, idx) => {
             const Icon = item.icon;
             return (
               <button
                 key={idx}
                 onClick={() => {
                   item.action();
                   setOpen(false);
                 }}
                 className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors text-left group/item"
               >
                 <div className="p-2 bg-slate-100 rounded-md text-slate-500 group-hover/item:bg-white group-hover/item:text-blue-600 transition-colors shadow-sm">
                    <Icon className="w-4 h-4" />
                 </div>
                 <span className="text-[15px] font-medium">{item.label}</span>
               </button>
             );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
