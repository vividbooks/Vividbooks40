import { useState } from 'react';

export interface UseImportStateReturn {
  showImportInput: boolean;
  setShowImportInput: (v: boolean) => void;
  importInputValue: string;
  setImportInputValue: (v: string) => void;
  jsonPreviewText: string | null;
  setJsonPreviewText: (v: string | null) => void;
  jsonPreviewLoading: boolean;
  setJsonPreviewLoading: (v: boolean) => void;
}

export function useImportState(): UseImportStateReturn {
  const [showImportInput, setShowImportInput] = useState(false);
  const [importInputValue, setImportInputValue] = useState('');
  const [jsonPreviewText, setJsonPreviewText] = useState<string | null>(null);
  const [jsonPreviewLoading, setJsonPreviewLoading] = useState(false);

  return {
    showImportInput, setShowImportInput,
    importInputValue, setImportInputValue,
    jsonPreviewText, setJsonPreviewText,
    jsonPreviewLoading, setJsonPreviewLoading,
  };
}
