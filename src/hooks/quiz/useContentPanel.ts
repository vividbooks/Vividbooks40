import { useState } from 'react';

export type ActivePanel = 'board' | 'content' | 'ai' | 'settings' | 'osnova';

export interface UseContentPanelReturn {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  contentPanelMode: 'add' | 'change';
  setContentPanelMode: (mode: 'add' | 'change') => void;
  showActivitiesSubmenu: boolean;
  setShowActivitiesSubmenu: (v: boolean) => void;
  showToolsSubmenu: boolean;
  setShowToolsSubmenu: (v: boolean) => void;
}

export function useContentPanel(initialPanel: ActivePanel): UseContentPanelReturn {
  const [activePanel, setActivePanel] = useState<ActivePanel>(initialPanel);
  const [contentPanelMode, setContentPanelMode] = useState<'add' | 'change'>('add');
  const [showActivitiesSubmenu, setShowActivitiesSubmenu] = useState(false);
  const [showToolsSubmenu, setShowToolsSubmenu] = useState(false);

  return {
    activePanel, setActivePanel,
    contentPanelMode, setContentPanelMode,
    showActivitiesSubmenu, setShowActivitiesSubmenu,
    showToolsSubmenu, setShowToolsSubmenu,
  };
}
