/**
 * useRAGSync - Hook pro synchronizaci dokumentů do Gemini RAG
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  uploadDocumentToRAG, 
  deleteDocumentFromRAG, 
  isGeminiConfigured,
  UploadDocumentParams 
} from '../utils/gemini-rag';

export type RAGStatus = 'none' | 'uploading' | 'indexing' | 'active' | 'error';

export interface RAGState {
  status: RAGStatus;
  documentId: string | null;
  indexedAt: Date | null;
  error: string | null;
}

export interface UseRAGSyncReturn {
  state: RAGState;
  isConfigured: boolean;
  syncToRAG: (params: UploadDocumentParams) => Promise<boolean>;
  removeFromRAG: (ragDocumentId: string) => Promise<boolean>;
  resetState: () => void;
}

const initialState: RAGState = {
  status: 'none',
  documentId: null,
  indexedAt: null,
  error: null
};

// Klíč pro localStorage
const RAG_CACHE_KEY = 'vividbooks_rag_cache';

/**
 * Hook pro správu synchronizace dokumentů do Gemini RAG
 */
export function useRAGSync(documentId?: string, initialRAGState?: Partial<RAGState>): UseRAGSyncReturn {
  // Načíst cache z localStorage
  const getCachedState = (): RAGState => {
    try {
      if (documentId) {
        const cache = localStorage.getItem(RAG_CACHE_KEY);
        if (cache) {
          const parsed = JSON.parse(cache);
          if (parsed[documentId]) {
            return {
              ...parsed[documentId],
              indexedAt: parsed[documentId].indexedAt ? new Date(parsed[documentId].indexedAt) : null
            };
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse RAG cache', e);
    }
    return {
      status: 'none',
      documentId: null,
      indexedAt: null,
      error: null,
      ...initialRAGState
    };
  };

  const [state, setState] = useState<RAGState>(getCachedState());

  // Reset state when documentId changes (user navigates to different page)
  useEffect(() => {
    const newState = getCachedState();
    setState(newState);
  }, [documentId]);

  // Uložit do cache při změně
  const updateState = (newState: RAGState | ((prev: RAGState) => RAGState)) => {
    setState(prev => {
      const next = typeof newState === 'function' ? newState(prev) : newState;
      
      // Save to local storage
      if (documentId) {
        try {
          const cache = JSON.parse(localStorage.getItem(RAG_CACHE_KEY) || '{}');
          cache[documentId] = next;
          localStorage.setItem(RAG_CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
          console.error('Failed to save RAG cache', e);
        }
      }
      
      return next;
    });
  };

  const isConfigured = isGeminiConfigured();

  /**
   * Synchronizovat dokument do RAG
   */
  const syncToRAG = useCallback(async (params: UploadDocumentParams): Promise<boolean> => {
    if (!isConfigured) {
      updateState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: 'Gemini API není nakonfigurováno' 
      }));
      return false;
    }

    // Nastavit stav na uploading
    updateState(prev => ({ ...prev, status: 'uploading', error: null }));

    try {
      // Změnit na indexing
      updateState(prev => ({ ...prev, status: 'indexing' }));
      
      const result = await uploadDocumentToRAG(params);

      if (result.success) {
        updateState({
          status: 'active',
          documentId: result.ragDocumentId || null,
          indexedAt: new Date(),
          error: null
        });
        return true;
      } else {
        updateState(prev => ({ 
          ...prev, 
          status: 'error', 
          error: result.error || 'Neznámá chyba při synchronizaci' 
        }));
        return false;
      }
    } catch (error) {
      updateState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Neznámá chyba'
      }));
      return false;
    }
  }, [isConfigured, documentId]);

  /**
   * Odebrat dokument z RAG
   */
  const removeFromRAG = useCallback(async (ragDocumentId: string): Promise<boolean> => {
    if (!isConfigured || !ragDocumentId) return false;

    try {
      const success = await deleteDocumentFromRAG(ragDocumentId);
      if (success) {
        updateState({
          status: 'none',
          documentId: null,
          indexedAt: null,
          error: null
        });
      }
      return success;
    } catch (error) {
      console.error('Error removing from RAG:', error);
      return false;
    }
  }, [isConfigured, documentId]);

  /**
   * Resetovat stav
   */
  const resetState = useCallback(() => {
    updateState({
      status: 'none',
      documentId: null,
      indexedAt: null,
      error: null
    });
  }, []);

  return { 
    state, 
    isConfigured,
    syncToRAG, 
    removeFromRAG,
    resetState
  };
}

