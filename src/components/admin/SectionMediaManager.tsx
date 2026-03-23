import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Image as ImageIcon, Film, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { SectionMediaItem, LottieStep, ImageStep } from '../../types/section-media';
import { generateLottieDescription, generateImageDescription } from '../../utils/lottie-description';
import { AssetPicker } from '../shared/AssetPicker';
import type { AssetPickerResult } from '../../types/assets';

interface SectionMediaManagerProps {
  mediaItems: SectionMediaItem[];
  availableHeadings: string[];
  onUpdate: (items: SectionMediaItem[]) => void;
  /** If true, hides the default list UI and only shows the dialog */
  dialogOnly?: boolean;
  /** Ref to expose openAddDialog and openEditDialog functions */
  dialogRef?: React.MutableRefObject<{ openAdd: () => void; openEdit: (index: number) => void } | null>;
  /** Images from the linked dataset (shown as extra tab in AssetPicker) */
  datasetImages?: Array<{ url: string; title?: string; alt?: string }>;
}

export function SectionMediaManager({ mediaItems, availableHeadings, onUpdate, dialogOnly, dialogRef, datasetImages }: SectionMediaManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedHeading, setSelectedHeading] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'lottie'>('image');

  // Image Form State (multi-step, same UX as Lottie)
  const [imageSteps, setImageSteps] = useState<ImageStep[]>([{ id: crypto.randomUUID(), url: '' }]);
  
  // Lottie Form State
  const [introUrl, setIntroUrl] = useState('');
  const [introDescription, setIntroDescription] = useState('');
  const [lottieSteps, setLottieSteps] = useState<LottieStep[]>([{ id: '1', url: '' }]);
  const [shouldLoop, setShouldLoop] = useState(true);
  
  // AI Generation State
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [generatingImageIndex, setGeneratingImageIndex] = useState<number | null>(null);

  // Asset Picker State
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetPickerTargetIndex, setAssetPickerTargetIndex] = useState<number>(0);

  const resetForm = () => {
    setEditingIndex(null);
    setSelectedHeading(availableHeadings[0] || '');
    setMediaType('image');
    setImageSteps([{ id: crypto.randomUUID(), url: '' }]);
    setIntroUrl('');
    setIntroDescription('');
    setLottieSteps([{ id: crypto.randomUUID(), url: '' }]);
    setShouldLoop(true);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: SectionMediaItem, index: number) => {
    setEditingIndex(index);
    setSelectedHeading(item.heading);
    setMediaType(item.type);
    
    if (item.type === 'image') {
      // Support both new imageSteps and legacy single imageUrl
      if (item.imageSteps && item.imageSteps.length > 0) {
        setImageSteps(JSON.parse(JSON.stringify(item.imageSteps)));
      } else {
        setImageSteps([{ id: crypto.randomUUID(), url: item.imageUrl || '', description: item.imageDescription }]);
      }
    } else {
      setIntroUrl(item.lottieConfig?.introUrl || '');
      setIntroDescription(item.lottieConfig?.introDescription || '');
      
      // Deep copy steps to ensure we don't have reference issues
      const steps = item.lottieConfig?.steps && item.lottieConfig.steps.length > 0 
        ? JSON.parse(JSON.stringify(item.lottieConfig.steps))
        : [{ id: crypto.randomUUID(), url: '' }];
        
      setLottieSteps(steps);
      setShouldLoop(item.lottieConfig?.shouldLoop ?? true);
    }
    
    setIsDialogOpen(true);
  };

  // Expose dialog functions via ref
  useEffect(() => {
    if (dialogRef) {
      dialogRef.current = {
        openAdd: openAddDialog,
        openEdit: (index: number) => {
          const item = mediaItems[index];
          if (item) openEditDialog(item, index);
        }
      };
    }
  }, [mediaItems, availableHeadings]);

  const handleSave = () => {
    if (!selectedHeading) return;

    // Always generate a new ID to ensure uniqueness and fix any legacy duplicate ID issues
    const validImageSteps = imageSteps.filter(s => s.url.trim() !== '');
    const newItem: SectionMediaItem = {
      id: crypto.randomUUID(),
      heading: selectedHeading,
      type: mediaType,
      ...(mediaType === 'image' ? {
        // Keep legacy fields for backward compat with older renderers
        imageUrl: validImageSteps[0]?.url || '',
        imageDescription: validImageSteps[0]?.description || undefined,
        imageSteps: validImageSteps,
      } : {}),
      ...(mediaType === 'lottie' ? {
        lottieConfig: {
          introUrl: introUrl || undefined,
          introDescription: introDescription || undefined,
          // Explicitly map steps to ensure all fields including AI descriptions are preserved
          steps: lottieSteps
            .filter(step => step.url.trim() !== '')
            .map(step => ({
              id: step.id,
              url: step.url,
              title: step.title,
              description: step.description,
              detailedDescription: step.detailedDescription,
              keywords: step.keywords
            })),
          shouldLoop,
          autoplay: true
        }
      } : {})
    };

    console.log('SectionMediaManager saving item:', newItem);

    if (editingIndex !== null) {
      // Update existing item by index
      const newItems = [...mediaItems];
      newItems[editingIndex] = newItem;
      onUpdate(newItems);
    } else {
      // Add new item
      onUpdate([...mediaItems, newItem]);
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (index: number) => {
    // Filter by index to ensure we only delete the specific item
    onUpdate(mediaItems.filter((_, i) => i !== index));
  };

  // Image step helpers
  const addImageStep = () => {
    setImageSteps([...imageSteps, { id: crypto.randomUUID(), url: '' }]);
  };

  const updateImageStep = (index: number, url: string) => {
    const next = [...imageSteps];
    next[index] = { ...next[index], url };
    setImageSteps(next);
  };

  const updateImageStepDescription = (index: number, description: string) => {
    const next = [...imageSteps];
    next[index] = { ...next[index], description };
    setImageSteps(next);
  };

  const removeImageStep = (index: number) => {
    if (imageSteps.length > 1) {
      setImageSteps(imageSteps.filter((_, i) => i !== index));
    }
  };

  const handleGenerateImageStepDescription = async (index: number) => {
    const step = imageSteps[index];
    if (!step.url) return;
    setGeneratingImageIndex(index);
    try {
      const result = await generateImageDescription(step.url, selectedHeading, step.description);
      const next = [...imageSteps];
      next[index] = { ...next[index], description: result.shortDescription };
      setImageSteps(next);
      toast.success('Popis obrázku byl vygenerován.');
    } catch (error) {
      console.error('Failed to generate image description:', error);
      alert('Nepodařilo se vygenerovat popis.');
    } finally {
      setGeneratingImageIndex(null);
    }
  };

  const openImagePicker = (index: number) => {
    setAssetPickerTargetIndex(index);
    setAssetPickerOpen(true);
  };

  const handleAssetSelect = (result: AssetPickerResult) => {
    updateImageStep(assetPickerTargetIndex, result.url);
    setAssetPickerOpen(false);
  };

  const addLottieStep = () => {
    setLottieSteps([...lottieSteps, { id: crypto.randomUUID(), url: '' }]);
  };

  const updateLottieStep = (index: number, url: string) => {
    const newSteps = [...lottieSteps];
    newSteps[index].url = url;
    setLottieSteps(newSteps);
  };

  const removeLottieStep = (index: number) => {
    if (lottieSteps.length > 1) {
      const newSteps = [...lottieSteps];
      newSteps.splice(index, 1);
      setLottieSteps(newSteps);
    }
  };

  const updateStepDescription = (index: number, description: string) => {
    const newSteps = [...lottieSteps];
    newSteps[index] = { ...newSteps[index], description };
    setLottieSteps(newSteps);
  };

  const updateStepKeywords = (index: number, keywords: string[]) => {
    const newSteps = [...lottieSteps];
    newSteps[index] = { ...newSteps[index], keywords };
    setLottieSteps(newSteps);
  };

  const handleGenerateDescription = async (index: number) => {
    const step = lottieSteps[index];
    if (!step.url) return;
    
    setGeneratingIndex(index);
    try {
      // Pass current description as user hint to guide the AI
      const result = await generateLottieDescription(step.url, selectedHeading, step.description);
      const newSteps = [...lottieSteps];
      newSteps[index] = {
        ...newSteps[index],
        description: result.shortDescription,
        detailedDescription: result.detailedDescription,
        keywords: result.keywords
      };
      setLottieSteps(newSteps);
      toast.success('Popis animace byl vygenerován.');
    } catch (error) {
      console.error('Failed to generate description:', error);
      alert('Nepodařilo se vygenerovat popis. Zkuste to znovu.');
    } finally {
      setGeneratingIndex(null);
    }
  };

  const handleGenerateIntroDescription = async () => {
    if (!introUrl) return;
    
    setGeneratingIntro(true);
    try {
      const result = await generateLottieDescription(introUrl, selectedHeading, introDescription);
      setIntroDescription(result.shortDescription);
      toast.success('Popis intra byl vygenerován.');
    } catch (error) {
      console.error('Failed to generate intro description:', error);
      alert('Nepodařilo se vygenerovat popis. Zkuste to znovu.');
    } finally {
      setGeneratingIntro(false);
    }
  };


  // If dialogOnly, just render the dialog
  if (dialogOnly) {
    return (
      <>
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!assetPickerOpen) setIsDialogOpen(open); }} modal={!assetPickerOpen}>
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? 'Upravit médium' : 'Přidat médium k sekci'}</DialogTitle>
              <DialogDescription>
                Vyberte sekci (H2) a přiřaďte k ní obrázek nebo interaktivní animaci.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Heading Selection */}
              <div className="space-y-2">
                <Label htmlFor="heading-select">Sekce (H2)</Label>
                <Select value={selectedHeading} onValueChange={setSelectedHeading}>
                  <SelectTrigger id="heading-select">
                    <SelectValue placeholder="Vyberte nadpis sekce" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableHeadings.length > 0 ? (
                      availableHeadings.map((h, i) => (
                        <SelectItem key={i} value={h}>{h}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-headings" disabled>Žádné H2 nadpisy v textu</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Selection */}
              <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image">Obrázek</TabsTrigger>
                  <TabsTrigger value="lottie">Animace (Lottie)</TabsTrigger>
                </TabsList>
                
                {/* Image Form */}
                <TabsContent value="image" className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Obrázky</Label>
                    <span className="text-xs text-muted-foreground">Pokud jich přidáte více, zobrazí se navigační tečky.</span>
                  </div>

                  {imageSteps.map((step, index) => (
                    <div key={step.id} className="border rounded-lg p-3 space-y-3 bg-background">
                      <div className="flex gap-2 items-start">
                        <div className="bg-muted w-8 h-10 flex items-center justify-center rounded text-xs font-medium shrink-0 mt-0.5 text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          {step.url ? (
                            <div
                              className="relative group cursor-pointer rounded border overflow-hidden"
                              onClick={() => openImagePicker(index)}
                            >
                              <img
                                src={step.url}
                                alt=""
                                className="w-full max-h-40 object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-sm font-medium">Změnit obrázek</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openImagePicker(index)}
                              className="w-full h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                            >
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Vybrat obrázek</span>
                            </button>
                          )}
                        </div>
                        {imageSteps.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeImageStep(index)}
                            className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {step.url && (
                        <div className="ml-10 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Popis obrázku (pro AI učitele)</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateImageStepDescription(index)}
                              disabled={generatingImageIndex === index || !step.url}
                              className="h-7 text-xs gap-1"
                            >
                              {generatingImageIndex === index ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                              ) : (
                                <><Sparkles className="w-3 h-3" /> Generovat AI</>
                              )}
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Co je na obrázku? AI učitel může na tuto informaci odkazovat..."
                            value={step.description || ''}
                            onChange={(e) => updateImageStepDescription(index, e.target.value)}
                            className="min-h-[60px] text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addImageStep}
                    className="w-full border-dashed gap-1 text-muted-foreground hover:text-primary"
                  >
                    <Plus className="w-4 h-4" /> Přidat další obrázek
                  </Button>
                </TabsContent>

                {/* Lottie Form */}
                <TabsContent value="lottie" className="space-y-6 pt-4">
                  {/* Intro Section */}
                  <div className="space-y-3 border p-4 rounded-lg bg-muted/10">
                    <Label className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-primary" /> Intro animace (volitelné)
                    </Label>
                    <Input 
                      placeholder="URL k intro JSON (přehraje se jednou na začátku)" 
                      value={introUrl}
                      onChange={(e) => setIntroUrl(e.target.value)}
                    />
                    {introUrl && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Popis pro AI učitele</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateIntroDescription}
                            disabled={generatingIntro || !introUrl}
                            className="h-7 text-xs gap-1"
                          >
                            {generatingIntro ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                            ) : (
                              <><Sparkles className="w-3 h-3" /> Generovat AI</>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Popis co se v animaci děje..."
                          value={introDescription}
                          onChange={(e) => setIntroDescription(e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Tato animace se přehraje jako první a plynule přejde do hlavní animace.
                    </p>
                  </div>

                  {/* Steps Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Hlavní animace</Label>
                      <span className="text-xs text-muted-foreground">Pokud jich přidáte více, zobrazí se navigační tečky.</span>
                    </div>
                    
                    {lottieSteps.map((step, index) => (
                      <div key={step.id} className="border rounded-lg p-3 space-y-3 bg-background">
                        <div className="flex gap-2 items-start">
                          <div className="bg-muted w-8 h-10 flex items-center justify-center rounded text-xs font-medium shrink-0 mt-0.5 text-muted-foreground">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <Input 
                              placeholder={`URL pro animaci #${index + 1}`}
                              value={step.url}
                              onChange={(e) => updateLottieStep(index, e.target.value)}
                            />
                          </div>
                          {lottieSteps.length > 1 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeLottieStep(index)}
                              className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Description Section */}
                        {step.url && (
                          <div className="ml-10 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">Popis animace (pro AI učitele)</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleGenerateDescription(index)}
                                disabled={generatingIndex === index || !step.url}
                                className="h-7 text-xs gap-1"
                              >
                                {generatingIndex === index ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                                ) : (
                                  <><Sparkles className="w-3 h-3" /> Generovat AI</>
                                )}
                              </Button>
                            </div>
                            <Textarea
                              placeholder="Co se v animaci děje? AI učitel může na tuto informaci odkazovat..."
                              value={step.description || ''}
                              onChange={(e) => updateStepDescription(index, e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                            {step.keywords && step.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {step.keywords.map((kw, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addLottieStep}
                      className="w-full border-dashed gap-1 text-muted-foreground hover:text-primary"
                    >
                      <Plus className="w-4 h-4" /> Přidat další animaci
                    </Button>
                  </div>

                  {/* Settings Section */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="space-y-0.5">
                      <Label>Smyčka (Loop)</Label>
                      <div className="text-xs text-muted-foreground">
                        Zda se má animace po dokončení opakovat
                      </div>
                    </div>
                    <Switch 
                      checked={shouldLoop} 
                      onCheckedChange={setShouldLoop} 
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <AssetPicker
              isOpen={assetPickerOpen}
              onClose={() => setAssetPickerOpen(false)}
              onSelect={handleAssetSelect}
              showUpload={true}
              showLibrary={true}
              showGiphy={false}
              showGoogle={true}
              showVividbooks={false}
              datasetImages={datasetImages}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Zrušit</Button>
              <Button onClick={handleSave}>Uložit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
    );
  }

  // Default full UI with Card and list
  return (
    <>
    <Card className="w-full border-dashed border-2 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Obrázky a animace k sekcím (H2)</CardTitle>
          </div>
          <Button onClick={openAddDialog} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> Přidat
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mediaItems.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-lg border border-dashed">
            Zatím žádné obrázky ani animace. Klikněte na "Přidat".
          </div>
        ) : (
          <div className="space-y-2">
            {mediaItems.map((item, index) => (
              <div 
                key={`${item.id}-${index}`} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border group hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col min-w-0 gap-1 cursor-pointer flex-1" onClick={() => openEditDialog(item, index)}>
                  <span className="font-medium text-sm truncate">{item.heading}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                    {item.type === 'image' ? (
                      <>
                        <ImageIcon className="w-3 h-3" />
                        <span className="truncate">
                          {item.imageSteps && item.imageSteps.length > 1
                            ? `${item.imageSteps.length} obrázků`
                            : (item.imageSteps?.[0]?.url || item.imageUrl || '')}
                        </span>
                      </>
                    ) : (
                      <>
                        <Film className="w-3 h-3 text-primary" />
                        <span className="truncate">
                          {item.lottieConfig?.steps.length} animací 
                          {item.lottieConfig?.introUrl ? ' + intro' : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 ml-2"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!assetPickerOpen) setIsDialogOpen(open); }} modal={!assetPickerOpen}>
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? 'Upravit médium' : 'Přidat médium k sekci'}</DialogTitle>
              <DialogDescription>
                Vyberte sekci (H2) a přiřaďte k ní obrázek nebo interaktivní animaci.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Heading Selection */}
              <div className="space-y-2">
                <Label htmlFor="heading-select">Sekce (H2)</Label>
                <Select value={selectedHeading} onValueChange={setSelectedHeading}>
                  <SelectTrigger id="heading-select">
                    <SelectValue placeholder="Vyberte nadpis sekce" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableHeadings.length > 0 ? (
                      availableHeadings.map((h, i) => (
                        <SelectItem key={i} value={h}>{h}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-headings" disabled>Žádné H2 nadpisy v textu</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Selection */}
              <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image">Obrázek</TabsTrigger>
                  <TabsTrigger value="lottie">Animace (Lottie)</TabsTrigger>
                </TabsList>
                
                {/* Image Form */}
                <TabsContent value="image" className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Obrázky</Label>
                    <span className="text-xs text-muted-foreground">Pokud jich přidáte více, zobrazí se navigační tečky.</span>
                  </div>

                  {imageSteps.map((step, index) => (
                    <div key={step.id} className="border rounded-lg p-3 space-y-3 bg-background">
                      <div className="flex gap-2 items-start">
                        <div className="bg-muted w-8 h-10 flex items-center justify-center rounded text-xs font-medium shrink-0 mt-0.5 text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          {step.url ? (
                            <div
                              className="relative group cursor-pointer rounded border overflow-hidden"
                              onClick={() => openImagePicker(index)}
                            >
                              <img
                                src={step.url}
                                alt=""
                                className="w-full max-h-40 object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-sm font-medium">Změnit obrázek</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openImagePicker(index)}
                              className="w-full h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                            >
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Vybrat obrázek</span>
                            </button>
                          )}
                        </div>
                        {imageSteps.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeImageStep(index)}
                            className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {step.url && (
                        <div className="ml-10 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Popis obrázku (pro AI učitele)</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateImageStepDescription(index)}
                              disabled={generatingImageIndex === index || !step.url}
                              className="h-7 text-xs gap-1"
                            >
                              {generatingImageIndex === index ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                              ) : (
                                <><Sparkles className="w-3 h-3" /> Generovat AI</>
                              )}
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Co je na obrázku? AI učitel může na tuto informaci odkazovat..."
                            value={step.description || ''}
                            onChange={(e) => updateImageStepDescription(index, e.target.value)}
                            className="min-h-[60px] text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addImageStep}
                    className="w-full border-dashed gap-1 text-muted-foreground hover:text-primary"
                  >
                    <Plus className="w-4 h-4" /> Přidat další obrázek
                  </Button>
                </TabsContent>

                {/* Lottie Form */}
                <TabsContent value="lottie" className="space-y-6 pt-4">
                  {/* Intro Section */}
                  <div className="space-y-3 border p-4 rounded-lg bg-muted/10">
                    <Label className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-primary" /> Intro animace (volitelné)
                    </Label>
                    <Input 
                      placeholder="URL k intro JSON (přehraje se jednou na začátku)" 
                      value={introUrl}
                      onChange={(e) => setIntroUrl(e.target.value)}
                    />
                    {introUrl && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Popis pro AI učitele</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateIntroDescription}
                            disabled={generatingIntro || !introUrl}
                            className="h-7 text-xs gap-1"
                          >
                            {generatingIntro ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                            ) : (
                              <><Sparkles className="w-3 h-3" /> Generovat AI</>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Popis co se v animaci děje..."
                          value={introDescription}
                          onChange={(e) => setIntroDescription(e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Tato animace se přehraje jako první a plynule přejde do hlavní animace.
                    </p>
                  </div>

                  {/* Steps Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Hlavní animace</Label>
                      <span className="text-xs text-muted-foreground">Pokud jich přidáte více, zobrazí se navigační tečky.</span>
                    </div>
                    
                    {lottieSteps.map((step, index) => (
                      <div key={step.id} className="border rounded-lg p-3 space-y-3 bg-background">
                        <div className="flex gap-2 items-start">
                          <div className="bg-muted w-8 h-10 flex items-center justify-center rounded text-xs font-medium shrink-0 mt-0.5 text-muted-foreground">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <Input 
                              placeholder={`URL pro animaci #${index + 1}`}
                              value={step.url}
                              onChange={(e) => updateLottieStep(index, e.target.value)}
                            />
                          </div>
                          {lottieSteps.length > 1 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeLottieStep(index)}
                              className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Description Section */}
                        {step.url && (
                          <div className="ml-10 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">Popis animace (pro AI učitele)</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleGenerateDescription(index)}
                                disabled={generatingIndex === index || !step.url}
                                className="h-7 text-xs gap-1"
                              >
                                {generatingIndex === index ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                                ) : (
                                  <><Sparkles className="w-3 h-3" /> Generovat AI</>
                                )}
                              </Button>
                            </div>
                            <Textarea
                              placeholder="Co se v animaci děje? AI učitel může na tuto animaci odkazovat..."
                              value={step.description || ''}
                              onChange={(e) => updateStepDescription(index, e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                            {step.keywords && step.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {step.keywords.map((kw, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addLottieStep}
                      className="w-full border-dashed gap-1 text-muted-foreground hover:text-primary"
                    >
                      <Plus className="w-4 h-4" /> Přidat další animaci
                    </Button>
                  </div>

                  {/* Settings Section */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="space-y-0.5">
                      <Label>Smyčka (Loop)</Label>
                      <div className="text-xs text-muted-foreground">
                        Zda se má animace po dokončení opakovat
                      </div>
                    </div>
                    <Switch 
                      checked={shouldLoop} 
                      onCheckedChange={setShouldLoop} 
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <AssetPicker
              isOpen={assetPickerOpen}
              onClose={() => setAssetPickerOpen(false)}
              onSelect={handleAssetSelect}
              showUpload={true}
              showLibrary={true}
              showGiphy={false}
              showGoogle={true}
              showVividbooks={false}
              datasetImages={datasetImages}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Zrušit</Button>
              <Button onClick={handleSave}>Uložit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  </>
  );
}
