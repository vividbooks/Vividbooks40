import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  Loader2, 
  Sparkles,
  FileText,
  BookOpen,
  Layout,
  Trash2,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Play,
  Eye,
  Copy,
  Wand2,
  Settings,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info';

interface AIContentAgentProps {
  isOpen: boolean;
  onClose: () => void;
  currentCategory: string;
  menuStructure: any[];
  onRefreshMenu: () => void;
  selectedItem?: any;
  selectedPageDetails?: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ProposedAction[];
  status?: 'pending' | 'executing' | 'completed' | 'error';
}

interface ProposedAction {
  id: string;
  type: 'create' | 'edit' | 'delete' | 'rename' | 'move' | 'translate' | 'generate';
  targetType: 'document' | 'worksheet' | 'board' | 'folder';
  targetSlug?: string;
  targetName?: string;
  description: string;
  details?: any;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: string;
}

// Use the same AI proxy as TeachMeChat (API keys are in Supabase secrets)
import { chatWithAIProxy } from '../../utils/ai-chat-proxy';

const SYSTEM_PROMPT = `Jsi AI asistent pro správu vzdělávacího obsahu v aplikaci Vividbooks. Jsi expert na tvorbu vzdělávacích materiálů pro základní a střední školy.

## CO UMÍŠ:

### 1. Vytvářet lekce (document/lesson)
Vzdělávací texty s:
- Úvodním textem (description)
- Hlavním obsahem s nadpisy H2 a H3
- Shrnutím v infoboxu
- Diskuzními otázkami
- Obrázky a animacemi

### 2. Vytvářet pracovní listy (worksheet)
PDF dokumenty s:
- Úkoly pro studenty
- Cvičeními k vyplnění
- Otázkami k zamyšlení
- Možností řešení

### 3. Vytvářet VividBoardy (board)
Interaktivní prezentace s:
- Informačními slidy (nadpis + obsah)
- Kvízovými aktivitami (ABC otázky, doplňování, spojování)
- Obrázky a videi

### 4. Editovat a překládat
- Měnit obsah existujících dokumentů (použij type: "edit")
- Překládat do libovolného jazyka:
  * Pokud uživatel chce nahradit stávající text, použij "edit" na původní slug.
  * Pokud uživatel chce NOVOU verzi (např. v angličtině), použij "create" s NOVÝM slugem (např. speed místo rychlost).
- Přejmenovávat položky (použij type: "rename", v details předej "newTitle", případně "newSlug" pokud chceš změnit i URL)

### 5. Organizovat
- Vytvářet složky (použij type: "create" a targetType: "folder")
- Přesouvat obsah
- Mazat položky (použij type: "delete")

## FORMÁT ODPOVĚDI:

VŽDY odpověz validním JSON objektem:
{
  "message": "Stručný popis co provedu",
  "actions": [
    {
      "type": "create|edit|delete|rename|move|translate|generate",
      "targetType": "document|worksheet|board|folder",
      "targetSlug": "slug-pro-url",
      "targetName": "Zobrazovaný název",
      "description": "Lidsky čitelný popis akce",
      "details": {
        "title": "Název dokumentu",
        "description": "Krátký popis pro náhled",
        "content": "<h2>Nadpis</h2><p>Obsah v HTML...</p>",
        "slides": [] // pro boardy - pole slide objektů
      }
    }
  ]
}

## PRAVIDLA PRO OBSAH:

1. **Lekce** - Použij HTML formát:
   - <h2> pro hlavní sekce
   - <h3> pro podsekce
   - <p> pro odstavce
   - <strong> pro důležité pojmy
   - <ul>/<ol> pro seznamy
   - Shrnutí: <div class="callout callout-summary">...</div>
   - Metodika: <div class="callout callout-methodology">...</div>

2. **Pracovní listy** - Strukturovaný HTML:
   - <h2>Úkol 1</h2> atd.
   - Prázdná pole: <input type="text" placeholder="..." />
   - Možnosti: <div class="options">A) ... B) ... C) ...</div>

3. **Boardy** - JSON slide formát:
   - Každý slide má: type, layout, blocks
   - type: "info" nebo název aktivity
   - layout: "title-content", "2cols", "title-2cols"
   - blocks: pole s { type: "text"/"image", content: "..." }

## DŮLEŽITÉ:
- Pro EDITACI, PŘEKLAD nebo PŘEJMENOVÁNÍ musíš použít PŘESNÝ targetSlug ze seznamu dostupných položek.
- Pro CREATE musíš vymyslet NOVÝ unikátní slug.
- Vždy generuj KOMPLETNÍ obsah, ne placeholder.
- Obsah musí být edukativní a správný.
- Pro překlad zachovej formátování.
- Slug vytvoř z názvu (bez diakritiky, pomlčky místo mezer).
- Odpovídej POUZE validním JSON, nic jiného.

Odpovídej česky.`;

export function AIContentAgent({ isOpen, onClose, currentCategory, menuStructure, onRefreshMenu, selectedItem, selectedPageDetails }: AIContentAgentProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Ahoj! 👋 Jsem AI asistent pro správu obsahu. Můžu ti pomoct s:\n\n• **Vytvářením** lekcí, pracovních listů a boardů\n• **Editací** existujícího obsahu\n• **Překladem** do jiných jazyků\n• **Organizací** složek a dokumentů\n\nCo potřebuješ?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<{action: ProposedAction; messageId: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const callGeminiAPI = async (userMessage: string): Promise<string> => {
    // Collect all slugs and labels from menu for context
    const allMenuItems: any[] = [];
    const collectItems = (items: any[]) => {
      items.forEach(item => {
        allMenuItems.push({ label: item.label, slug: item.slug, type: item.type });
        if (item.children) collectItems(item.children);
      });
    };
    collectItems(menuStructure);

    const contextInfo = `
Aktuální kategorie: ${currentCategory}
Vybraná položka: ${selectedItem ? `${selectedItem.label} (slug: ${selectedItem.slug})` : 'žádná'}
${selectedPageDetails ? `Obsah vybrané položky:
${JSON.stringify({
  title: selectedPageDetails.title,
  description: selectedPageDetails.description,
  content: selectedPageDetails.content?.substring(0, 5000), // Send first 5k chars
  documentType: selectedPageDetails.documentType
}, null, 2)}` : ''}

Dostupné položky v kategorii (seznam):
${allMenuItems.map(item => `- ${item.label} (slug: ${item.slug}, typ: ${item.type})`).join('\n')}
`;

    // Use the same AI proxy as TeachMeChat (API keys are in Supabase secrets)
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT + '\n\nKontext prostředí:\n' + contextInfo },
      { role: 'user' as const, content: userMessage }
    ];

    const response = await chatWithAIProxy(messages, 'gemini-3-flash', {
      temperature: 0.7,
      max_tokens: 4096,
    });

    return response || 'Nepodařilo se získat odpověď.';
  };

  const parseAIResponse = (response: string): { message: string; actions: ProposedAction[] } => {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          message: parsed.message || response,
          actions: (parsed.actions || []).map((a: any, i: number) => ({
            ...a,
            id: `action-${Date.now()}-${i}`,
            status: 'pending'
          }))
        };
      }
    } catch (e) {
      // If JSON parsing fails, return the response as a message
    }
    return { message: response, actions: [] };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await callGeminiAPI(input.trim());
      const { message, actions } = parseAIResponse(response);

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-response`,
        role: 'assistant',
        content: message,
        timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined,
        status: actions.length > 0 ? 'pending' : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeActions = async (messageId: string, actions: ProposedAction[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      alert('Nejste přihlášeni');
      return;
    }

    // Update message status to executing
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, status: 'executing' } : m
    ));

    for (const action of actions) {
      // Update individual action status
      setMessages(prev => prev.map(m => 
        m.id === messageId ? {
          ...m,
          actions: m.actions?.map(a => 
            a.id === action.id ? { ...a, status: 'executing' } : a
          )
        } : m
      ));

      try {
        await executeAction(action, accessToken);
        
        // Update action as completed
        setMessages(prev => prev.map(m => 
          m.id === messageId ? {
            ...m,
            actions: m.actions?.map(a => 
              a.id === action.id ? { ...a, status: 'completed', result: 'Úspěšně provedeno' } : a
            )
          } : m
        ));
      } catch (error) {
        // Update action as error
        setMessages(prev => prev.map(m => 
          m.id === messageId ? {
            ...m,
            actions: m.actions?.map(a => 
              a.id === action.id ? { 
                ...a, 
                status: 'error', 
                result: error instanceof Error ? error.message : 'Chyba' 
              } : a
            )
          } : m
        ));
      }
    }

    // Update message status
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const allCompleted = m.actions?.every(a => a.status === 'completed');
        const hasError = m.actions?.some(a => a.status === 'error');
        return { 
          ...m, 
          status: hasError ? 'error' : (allCompleted ? 'completed' : 'pending')
        };
      }
      return m;
    }));

    // Refresh menu
    onRefreshMenu();
  };

  const executeAction = async (action: ProposedAction, accessToken: string) => {
    const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b`;

    switch (action.type) {
      case 'create':
      case 'generate':
        if (action.targetType === 'board' && action.details?.slides) {
          // Create VividBoard (stored in localStorage for now, similar to existing boards)
          const boardId = `board-${Date.now()}`;
          const boardData = {
            id: boardId,
            title: action.details?.title || action.targetName,
            slides: action.details.slides.map((slide: any, i: number) => ({
              id: `slide-${Date.now()}-${i}`,
              type: slide.type || 'info',
              layout: slide.layout || 'title-content',
              blocks: slide.blocks || [],
              background: slide.background || { type: 'color', value: '#ffffff' }
            })),
            settings: { theme: 'default' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Save to localStorage (boards use local storage)
          const existingBoards = JSON.parse(localStorage.getItem('vividbooks_quizzes') || '[]');
          existingBoards.push({
            id: boardId,
            title: boardData.title,
            slidesCount: boardData.slides.length,
            updatedAt: boardData.updatedAt
          });
          localStorage.setItem('vividbooks_quizzes', JSON.stringify(existingBoards));
          localStorage.setItem(`vividbooks_quiz_${boardId}`, JSON.stringify(boardData));
          
          console.log('[AI] Created board:', boardId);
        } else {
          // Create document/worksheet in Deno KV
          const createResponse = await fetch(`${baseUrl}/pages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: action.details?.title || action.targetName,
              slug: action.details?.slug || action.targetSlug || generateSlug(action.targetName || ''),
              content: action.details?.content || '',
              description: action.details?.description || '',
              category: currentCategory,
              documentType: action.targetType === 'worksheet' ? 'worksheet' : 'lesson'
            })
          });
          
          if (!createResponse.ok) {
            throw new Error(`Failed to create: ${await createResponse.text()}`);
          }
        }
        break;

      case 'edit':
      case 'translate':
        // Edit existing document
        if (!action.targetSlug) {
          throw new Error('Target slug is required for editing');
        }

        const editResponse = await fetch(`${baseUrl}/pages/${encodeURIComponent(action.targetSlug)}?category=${currentCategory}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            category: currentCategory,
            ...action.details
          })
        });
        
        if (!editResponse.ok) {
          throw new Error(`Failed to edit: ${await editResponse.text()}`);
        }
        break;

      case 'delete':
        if (!action.targetSlug) {
          throw new Error('Target slug is required for deletion');
        }

        const deleteResponse = await fetch(
          `${baseUrl}/pages/${encodeURIComponent(action.targetSlug)}?category=${currentCategory}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!deleteResponse.ok) {
          throw new Error(`Failed to delete: ${await deleteResponse.text()}`);
        }
        break;

      case 'rename':
        // Rename = edit with new title
        if (!action.targetSlug) {
          throw new Error('Target slug is required for renaming');
        }

        const renameResponse = await fetch(`${baseUrl}/pages/${encodeURIComponent(action.targetSlug)}?category=${currentCategory}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            category: currentCategory,
            title: action.details?.newTitle || action.targetName,
            newSlug: action.details?.newSlug
          })
        });
        
        if (!renameResponse.ok) {
          throw new Error(`Failed to rename: ${await renameResponse.text()}`);
        }
        break;

      case 'move':
        // Move requires menu update
        console.log('[AI] Move action - would need menu structure update');
        throw new Error('Přesouvání zatím není implementováno');

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  };

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create':
      case 'generate': return <Sparkles className="w-4 h-4 text-green-500" />;
      case 'edit': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'delete': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'rename': return <FileText className="w-4 h-4 text-amber-500" />;
      case 'move': return <Layout className="w-4 h-4 text-purple-500" />;
      case 'translate': return <BookOpen className="w-4 h-4 text-indigo-500" />;
      default: return <Wand2 className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return null;
      case 'executing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed': return <Check className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div 
      className="fixed right-0 w-[450px] max-w-full bg-white shadow-2xl z-[100] flex flex-col border-l border-slate-200"
      style={{ top: 0, bottom: 0, height: '100vh', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-500 to-purple-600 flex-shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Bot className="w-6 h-6" />
          <div>
            <h2 className="font-semibold">AI Asistent</h2>
            <p className="text-xs text-white/70">Gemini 3.0 Flash</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded hover:bg-white/20 text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-600">
            <strong>Model:</strong> Gemini 3.0 Flash (přes Supabase proxy)
          </p>
          <p className="text-xs text-slate-500 mt-1">
            <strong>Kategorie:</strong> {currentCategory}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            <strong>Položek v menu:</strong> {menuStructure.length}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 break-words overflow-hidden ${
                message.role === 'user'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {/* Message content */}
              <div className="text-sm whitespace-pre-wrap break-words overflow-hidden">
                {message.content.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line.includes('**') ? (
                      <span dangerouslySetInnerHTML={{ 
                        __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                      }} />
                    ) : (
                      line
                    )}
                    {i < message.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>

              {/* Actions */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Wand2 className="w-3 h-3" />
                    Navržené akce:
                  </div>
                  {message.actions.map((action) => (
                    <div
                      key={action.id}
                      className={`bg-white rounded-lg p-2.5 border ${
                        action.status === 'completed' ? 'border-green-300 bg-green-50' :
                        action.status === 'error' ? 'border-red-300 bg-red-50' :
                        'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {getActionIcon(action.type)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-800">
                            {action.description}
                          </div>
                          {action.targetName && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              Cíl: {action.targetName}
                            </div>
                          )}
                          {action.result && (
                            <div className={`text-xs mt-1 ${
                              action.status === 'error' ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {action.result}
                            </div>
                          )}
                          
                          {/* Preview button for create/generate actions */}
                          {(action.type === 'create' || action.type === 'generate') && action.details?.content && action.status === 'pending' && (
                            <button
                              onClick={() => setPreviewContent({ action, messageId: message.id })}
                              className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Zobrazit náhled obsahu
                            </button>
                          )}
                          
                          {/* Expandable details */}
                          {action.details && (
                            <button
                              onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                              className="mt-1 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                            >
                              {expandedAction === action.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {expandedAction === action.id ? 'Skrýt detaily' : 'Zobrazit detaily'}
                            </button>
                          )}
                          
                          {expandedAction === action.id && action.details && (
                            <pre className="mt-2 text-[10px] bg-slate-900 text-green-400 p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(action.details, null, 2)}
                            </pre>
                          )}
                        </div>
                        {getStatusIcon(action.status)}
                      </div>
                    </div>
                  ))}

                  {/* Execute button */}
                  {message.status === 'pending' && (
                    <button
                      onClick={() => executeActions(message.id, message.actions!)}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        borderRadius: '8px',
                        fontWeight: 500,
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
                    >
                      <Play className="w-4 h-4" />
                      Provést všechny akce
                    </button>
                  )}

                  {message.status === 'completed' && (
                    <div className="text-center text-sm text-green-600 font-medium mt-2">
                      ✓ Všechny akce dokončeny
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div className={`text-[10px] mt-1 ${
                message.role === 'user' ? 'text-white/60' : 'text-slate-400'
              }`}>
                {message.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-sm text-slate-600">Přemýšlím...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto flex-shrink-0 bg-white">
        <button
          onClick={() => setInput('Vytvoř novou lekci o ')}
          className="flex-shrink-0 px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
        >
          + Nová lekce
        </button>
        <button
          onClick={() => setInput('Vytvoř nový pracovní list na téma ')}
          className="flex-shrink-0 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
        >
          + Pracovní list
        </button>
        <button
          onClick={() => setInput('Vytvoř nový VividBoard prezentaci o ')}
          className="flex-shrink-0 px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
        >
          + VividBoard
        </button>
        <button
          onClick={() => setInput('Přelož lekci ')}
          className="flex-shrink-0 px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
        >
          🌍 Překlad
        </button>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Napiš co potřebuješ... (Enter = odeslat)"
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
    
    {/* Preview Modal */}
    {previewContent && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h3 className="font-semibold text-lg text-slate-800">
                Náhled: {previewContent.action.details?.title || previewContent.action.targetName}
              </h3>
              <p className="text-sm text-slate-500">
                Typ: {previewContent.action.targetType} | Akce: {previewContent.action.type}
              </p>
            </div>
            <button
              onClick={() => setPreviewContent(null)}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Description */}
            {previewContent.action.details?.description && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Popis</div>
                <p className="text-sm text-slate-700">{previewContent.action.details.description}</p>
              </div>
            )}
            
            {/* HTML Content Preview */}
            {previewContent.action.details?.content && (
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-3">Obsah</div>
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewContent.action.details.content }}
                />
              </div>
            )}
            
            {/* Slides Preview for Boards */}
            {previewContent.action.details?.slides && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-400 uppercase">
                  Slidy ({previewContent.action.details.slides.length})
                </div>
                {previewContent.action.details.slides.map((slide: any, idx: number) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="text-xs font-medium text-slate-500 mb-2">
                      Slide {idx + 1}: {slide.type} ({slide.layout})
                    </div>
                    {slide.blocks?.map((block: any, bi: number) => (
                      <div key={bi} className="bg-white p-2 rounded border border-slate-100 mt-2">
                        <span className="text-xs text-slate-400">{block.type}:</span>
                        <div className="text-sm">{block.content?.substring(0, 200)}...</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              onClick={() => setPreviewContent(null)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              Zavřít
            </button>
            <button
              onClick={() => {
                executeActions(previewContent.messageId, [previewContent.action]);
                setPreviewContent(null);
              }}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Vytvořit tento obsah
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

