/**
 * useAIChat - Custom hook pro AI chat v editoru pracovních listů
 * 
 * Spravuje stav AI chatu a komunikaci s AI API
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  AIMessage,
  AIAction,
  createAIMessage,
} from '../types/worksheet-editor';
import {
  Worksheet,
  WorksheetBlock,
  Subject,
  Grade,
} from '../types/worksheet';
import {
  generateWorksheetContent,
  createAIResponseMessage,
  QUICK_PROMPTS_EMPTY,
  QUICK_PROMPTS_WITH_CONTENT,
  createContextualGreeting,
} from '../utils/ai-worksheet-generator';

interface UseAIChatOptions {
  worksheet: Worksheet | null;
  onAddBlocks: (blocks: WorksheetBlock[]) => void;
  onUpdateWorksheet?: (updates: Partial<Worksheet>) => void;
}

interface QuickPrompt {
  label: string;
  prompt: string;
  icon: string;
}

interface UseAIChatReturn {
  // State
  messages: AIMessage[];
  isLoading: boolean;
  inputValue: string;
  
  // Actions
  setInputValue: (value: string) => void;
  sendMessage: (customPrompt?: string) => Promise<void>;
  applyAction: (action: AIAction, messageId: string) => void;
  clearChat: () => void;
  refreshContext: () => void;
  
  // Helpers
  quickPrompts: QuickPrompt[];
  hasContent: boolean;
  chatRef: React.RefObject<HTMLDivElement>;
}

export function useAIChat({
  worksheet,
  onAddBlocks,
  onUpdateWorksheet,
}: UseAIChatOptions): UseAIChatReturn {
  // Check if worksheet has content
  const hasContent = (worksheet?.blocks?.length || 0) > 0;
  
  // State - initialized with context-aware greeting
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [initialized, setInitialized] = useState(false);
  
  // Initialize with contextual greeting when worksheet loads
  React.useEffect(() => {
    if (!initialized && worksheet) {
      const greeting = createContextualGreeting(
        worksheet.blocks || [],
        worksheet.metadata?.topic
      );
      setMessages([createAIMessage('assistant', greeting)]);
      setInitialized(true);
    }
  }, [worksheet, initialized]);
  
  // Function to refresh context (when blocks change significantly)
  const refreshContext = useCallback(() => {
    if (worksheet) {
      const greeting = createContextualGreeting(
        worksheet.blocks || [],
        worksheet.metadata?.topic
      );
      setMessages([createAIMessage('assistant', greeting)]);
    }
  }, [worksheet]);
  
  // Refs
  const chatRef = useRef<HTMLDivElement>(null);
  const pendingBlocksRef = useRef<WorksheetBlock[] | null>(null);

  // Scroll to bottom when new message arrives
  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      setTimeout(() => {
        chatRef.current?.scrollTo({
          top: chatRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, []);

  /**
   * Odešle zprávu do AI
   */
  const sendMessage = useCallback(async (customPrompt?: string) => {
    const prompt = customPrompt || inputValue.trim();
    if (!prompt || isLoading) return;

    // Add user message
    const userMessage = createAIMessage('user', prompt);
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    scrollToBottom();

    try {
      // Build context
      const context = {
        subject: worksheet?.metadata.subject as Subject | undefined,
        grade: worksheet?.metadata.grade as Grade | undefined,
        topic: worksheet?.metadata.topic,
        existingBlocks: worksheet?.blocks,
      };

      // Call AI
      const response = await generateWorksheetContent({
        prompt,
        context,
      });

      // Store pending blocks if any
      if (response.blocks && response.blocks.length > 0) {
        pendingBlocksRef.current = response.blocks;
      }

      // Add AI response message
      const aiMessage = createAIResponseMessage(response);
      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('AI chat error:', error);
      
      // Add error message
      const errorMessage = createAIMessage(
        'assistant',
        'Omlouvám se, něco se pokazilo. Zkuste to prosím znovu.'
      );
      errorMessage.error = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [inputValue, isLoading, worksheet, scrollToBottom]);

  /**
   * Aplikuje AI akci
   */
  const applyAction = useCallback((action: AIAction, messageId: string) => {
    if (action.type === 'generate-content' && pendingBlocksRef.current) {
      // Add blocks to worksheet
      onAddBlocks(pendingBlocksRef.current);
      pendingBlocksRef.current = null;

      // Mark message as applied
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, applied: true } : msg
      ));

      // Add confirmation message
      const confirmMessage = createAIMessage(
        'assistant',
        '✅ Bloky byly přidány do pracovního listu. Můžeš je upravit v editoru vpravo nebo mi říct, co dalšího potřebuješ.'
      );
      setMessages(prev => [...prev, confirmMessage]);
      scrollToBottom();
    }

    if (action.type === 'add-block' && action.payload?.blockType) {
      // This would add a single block - handled by parent
      // For now, just add a message
      const confirmMessage = createAIMessage(
        'assistant',
        `Přidávám blok typu "${action.payload.blockType}"...`
      );
      setMessages(prev => [...prev, confirmMessage]);
    }

    if (action.type === 'update-metadata' && action.payload?.metadata && onUpdateWorksheet) {
      onUpdateWorksheet({ metadata: { ...worksheet?.metadata, ...action.payload.metadata } as any });
      
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, applied: true } : msg
      ));
    }
  }, [onAddBlocks, onUpdateWorksheet, worksheet, scrollToBottom]);

  /**
   * Vymaže historii chatu
   */
  const clearChat = useCallback(() => {
    setMessages([
      createAIMessage(
        'assistant',
        'Chat byl vymazán. Jak ti mohu pomoci?'
      ),
    ]);
    pendingBlocksRef.current = null;
  }, []);

  // Select appropriate quick prompts based on content
  const quickPrompts = hasContent ? QUICK_PROMPTS_WITH_CONTENT : QUICK_PROMPTS_EMPTY;

  return {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    applyAction,
    clearChat,
    refreshContext,
    quickPrompts,
    hasContent,
    chatRef,
  };
}




