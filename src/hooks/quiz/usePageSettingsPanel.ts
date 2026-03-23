import { useState } from 'react';

export type PageSettingsSection =
  | 'type'
  | 'template'
  | 'layout'
  | 'background'
  | 'chapter'
  | 'note'
  | 'comments'
  | undefined;

export interface UsePageSettingsPanelReturn {
  showPageSettings: boolean;
  setShowPageSettings: (v: boolean) => void;
  pageSettingsSection: PageSettingsSection;
  setPageSettingsSection: (section: PageSettingsSection) => void;
  pageSettingsInitialShowActivities: boolean;
  setPageSettingsInitialShowActivities: (v: boolean) => void;
  openPageSettings: (section?: PageSettingsSection, showActivities?: boolean) => void;
  togglePageSettings: () => void;
}

export function usePageSettingsPanel(
  onClearBlockSelection: () => void
): UsePageSettingsPanelReturn {
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [pageSettingsSection, setPageSettingsSection] = useState<PageSettingsSection>(undefined);
  const [pageSettingsInitialShowActivities, setPageSettingsInitialShowActivities] = useState(false);

  const openPageSettings = (section?: PageSettingsSection, showActivities = false) => {
    onClearBlockSelection();
    setPageSettingsSection(section);
    setPageSettingsInitialShowActivities(showActivities);
    setShowPageSettings(true);
  };

  const togglePageSettings = () => {
    if (showPageSettings) {
      setShowPageSettings(false);
      setPageSettingsSection(undefined);
      setPageSettingsInitialShowActivities(false);
    } else {
      onClearBlockSelection();
      setPageSettingsSection(undefined);
      setShowPageSettings(true);
    }
  };

  return {
    showPageSettings, setShowPageSettings,
    pageSettingsSection, setPageSettingsSection,
    pageSettingsInitialShowActivities, setPageSettingsInitialShowActivities,
    openPageSettings,
    togglePageSettings,
  };
}
