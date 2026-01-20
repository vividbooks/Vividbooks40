/**
 * Hook pro použití AssetPickeru
 * 
 * Usnadňuje otevírání AssetPickeru a zpracování výběru
 */

import { useState, useCallback } from 'react';
import type { AssetPickerResult, AssetPickerConfig } from '../types/assets';

interface UseAssetPickerOptions extends Omit<AssetPickerConfig, 'onSelect' | 'onClose'> {}

export function useAssetPicker(options: UseAssetPickerOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetPickerResult | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback((result: AssetPickerResult) => {
    setSelectedAsset(result);
    setIsOpen(false);
    return result;
  }, []);

  const clear = useCallback(() => {
    setSelectedAsset(null);
  }, []);

  return {
    isOpen,
    open,
    close,
    selectedAsset,
    handleSelect,
    clear,
    pickerProps: {
      isOpen,
      onClose: close,
      onSelect: handleSelect,
      ...options,
    },
  };
}

export default useAssetPicker;




