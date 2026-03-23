# PDF Export – FINÁLNÍ ŘEŠENÍ (v3)

## Deployment Note

- V dev režimu je v `src/hooks/usePDFExport.ts` dočasný fallback: místo serverového Browserless exportu se otevírá lokální `/print/:id` stránka.
- Důvod: serverový export běží proti nasazené appce na GitHub Pages, takže bez deploye nevidí lokální změny v PDF rendereru.
- Po nasazení aktuální frontend verze je potřeba myslet na návrat k přímému PDF exportu jedním klikem a ověřit, že Browserless už renderuje nový `/print` build správně.

## VÝCHOZÍ STAV – CO EXISTUJE

### Pipeline (jak to teď funguje):

```
[Klient]                       [Supabase Edge Functions]              [Browserless.io]
   │                                    │                                    │
   │  usePDFExport hook                 │                                    │
   │  → pdf-export.ts                   │                                    │
   │     POST /pdf-export               │                                    │
   │  ────────────────────────────►     │                                    │
   │                                    │  pdf-export/index.ts               │
   │                                    │  → sestaví URL /print/:id          │
   │                                    │  → POST na Browserless /pdf ──────►│
   │                                    │                                    │  Browserless otevře
   │                                    │                                    │  /print/:worksheetId
   │                                    │                                    │  ↓
   │                                    │                                    │  PrintPage.tsx
   │                                    │                                    │  → fetchWorksheetViaProxy()
   │                                    │   ◄────── GET /get-worksheet ──────│     (anon klíč)
   │                                    │   get-worksheet/index.ts           │
   │                                    │   → service_role → Supabase DB     │
   │                                    │   → vrátí JSON worksheetu ────────►│
   │                                    │                                    │  → setWorksheet()
   │                                    │                                    │  → <PrintGridCanvas>
   │                                    │                                    │  → __PRINT_READY__ = true
   │                                    │                                    │  ↓
   │                                    │                                    │  Browserless: page.pdf()
   │                                    │  ◄──────────── PDF binárně ────────│
   │  ◄──────── PDF blob ──────────     │                                    │
   │  → createObjectURL + download      │                                    │
```

### Soubory v pipeline:

| Soubor | Role |
|--------|------|
| `src/utils/pdf-export.ts` | Klientská utilita – POST na edge function, stáhne PDF blob |
| `src/hooks/usePDFExport.ts` | React hook – volá `exportWorksheetPDF`, fallback na window.open |
| `supabase/functions/pdf-export/index.ts` | Edge function – volá Browserless API |
| `supabase/functions/get-worksheet/index.ts` | Edge function – proxy pro čtení worksheetu (service_role) |
| `src/components/worksheet-editor-pro/PrintPage.tsx` | React stránka na `/print/:id` – wrapper pro tisk |
| `src/components/worksheet-editor-pro/PrintGridCanvas.tsx` | Read-only verze GridCanvas pro PDF |
| `src/components/worksheet-editor-pro/GridCanvas.tsx` | Hlavní editor canvas (reference) |
| `src/components/worksheet-editor/EditableBlock.tsx` | Sdílený renderovací blok |
| `src/components/worksheet-editor-pro/PageHeaderFooter.tsx` | Header/Footer komponenty |
| `src/index.css` | Globální CSS (obsahuje destruktivní print pravidla) |
| `src/styles/globals.css` | Font-face definice, base styly |

---

## KOMPLETNÍ AUDIT – CO JE ŠPATNĚ

### BUG 1: DESTRUKTIVNÍ CSS V `index.css` (řádky 5453–5580)

**Sekce 1** (`@media print`, řádek 5453):
- `body { font-size: 8pt !important }` → přepíše VŠECHNY fonty na 8pt
- `h1 { font-size: 14pt !important }` → přepíše custom velikosti nadpisů
- `p, li, td { font-size: 8pt !important; line-height: 1.2 }` → zničí text
- `code { font-size: 7pt !important; background: #f5f5f5 !important }` → přepíše code bloky
- `a[href]:after { content: " (" attr(href) ")" }` → přidá URL za každý odkaz

Tato sekce je pozůstatek z dokumentační části aplikace (Tiptap editor). Pro worksheet editor je 100% destruktivní.

**Sekce 2** (`@media print`, řádek 5586):
- `.a4-page * { background: transparent !important; border-color: #cbd5e1 !important; }` (řádek 5612–5615) → **ZABIJE VŠECHNY BARVY** – infoboxy, pozadí otázek, custom borders
- `.a4-page h1/h2/h3` (řádky 5607–5609) → přepisuje heading velikosti na fixní pt
- Následuje "záplata": `.a4-page .bg-blue-50 { background-color: ... }` (řádky 5618–5633) → pokus o obnovení barev přes tailwind třídy, ale **NEFUNGUJE** protože editor používá inline styles (ne tailwind třídy)

V sekci 2 jsou i **UŽITEČNÉ** věci:
- `@page { size: A4; margin: 0; }` → potřebné pro Ctrl+P
- `.top-controls, .left-toolbar { display: none !important }` → skrývání editor UI
- `.a4-page { width: 210mm; page-break-after: always }` → page breaks
- `.activity-number-circle { -webkit-print-color-adjust: exact }` → zachování barev kroužků
- `.overflow-hidden, .h-screen { overflow: visible !important; height: auto !important }` → odemknutí scrollu

### BUG 2: PRINTPAGE OBALUJE CELÝ WORKSHEET JEDNÍM BLEED WRAPPEREM

```tsx
// PrintPage.tsx – aktuální stav:
<div className="bleed-wrapper">        // ← JEDEN wrapper kolem VŠECH stránek
  {showCropMarks && <CropMarks />}     // ← crop marks jen na vnějšku
  <div className="page-inset">          // ← 5mm margin kolem VŠEHO
    <PrintGridCanvas worksheet={ws} />  // ← renderuje N stránek vertikálně
  </div>
</div>
```

**Problém:** `PrintGridCanvas` renderuje VÍCE A4 stránek vertikálně. Bleed wrapper je ale JEDEN a obaluje je všechny. To znamená:
- Crop marks jsou jen nahoře a dole celého "sloupce"
- Bleed (5mm margin) je kolem celku, ne kolem každé stránky
- Browserless nastavený na 220×307mm vytiskne JEDNU obří stránku, ne N stránek

### BUG 3: BROWSERLESS ROZMĚRY NESEDÍ

Edge function nastavuje:
```typescript
options: {
  width: '220mm',   // A4 + 2×5mm bleed
  height: '307mm',  // A4 + 2×5mm bleed
}
```

Ale obsah (`PrintGridCanvas`) renderuje stránky o rozměrech 794×1123px (čisté A4 při 96dpi). Tyto rozměry se neshodují. Výsledek: zmenšení/zvětšení obsahu, nesprávné page breaks.

### BUG 4: `__PRINT_READY__` SE NASTAVÍ PŘÍLIŠ BRZY

```tsx
// PrintPage.tsx:
useEffect(() => {
  if (worksheet) {
    (window as any).__PRINT_READY__ = true;  // ← OKAMŽITĚ po setWorksheet
  }
}, [worksheet]);
```

**Problém:** `PrintGridCanvas` po mount potřebuje:
1. Vyrenderovat všechny bloky
2. `ResizeObserver` změří výšky bloků
3. Přepočítá se paginace
4. Re-render s novými výškami
5. Další ResizeObserver cyklus (výšky se mohou změnit po re-renderu)
6. Fonty se musí načíst (Fenomen Sans, Cooper Light z externích URL)

Žádný z těchto kroků NEPROBĚHNE před nastavením `__PRINT_READY__`. Browserless generuje PDF z nedokončeného renderu.

### BUG 5: MEZERA MEZI STRÁNKAMI V TISKU

```tsx
// PrintGridCanvas.tsx:
marginBottom: pageIndex < pagesData.length - 1 ? '40px' : 0,
// ...
{pageIndex < pagesData.length - 1 && (
  <div style={{ height: '40px' }} />  // ← 40px mezera mezi stránkami
)}
```

Tyto 40px mezery jsou vhodné pro editační náhled na obrazovce, ale v PDF se stanou součástí obsahu. Browserless je nevyhodí – vytisknou se jako prázdný prostor.

### BUG 6: NEEXISTUJE `page-break-after` V PRINTGRIDCANVAS

`PrintGridCanvas` NEMÁ žádné CSS page-break pravidlo na stránkách. Jediný page break je v `index.css` na třídě `.a4-page`, ale `PrintGridCanvas` nepoužívá třídu `.a4-page` na svých stránkách.

### BUG 7: SAFE ZONE NENÍ VYNUCENÁ V PAGINACI

Stávající contentHeight:
```typescript
const contentPaddingV = 16 + 16; // paddingTop + paddingBottom
const contentHeight = pageHeight - HEADER_HEIGHT - FOOTER_HEIGHT - contentPaddingV;
```

Padding 16px = 4.2mm. Safe zone by měla být 5mm = 19px. Obsah tedy může sahat 0.8mm blíže k okraji papíru, než je bezpečné.

ALE: Header (60px = 16mm) a Footer (56px = 15mm) se samy o sobě starají o vertikální safe zone. Problém nastává POUZE když:
- Header je VYPNUTÝ → obsah začíná jen 16px (4.2mm) od horního okraje
- Footer je VYPNUTÝ → obsah končí jen 16px (4.2mm) od spodního okraje

### BUG 8: FONTY V BROWSERLESS

Fonty se loadují dvěma cestami:
1. `src/styles/globals.css` – `@font-face` definice (Fenomen Sans, Cooper Light) z externích Supabase URL
2. `src/main.tsx` – `FontFace` API pro Cooper Light (redundantní, ale OK)

Browserless navštíví `/print/:worksheetId`, což načte celou React aplikaci včetně `globals.css` → fonty by se MĚLY načíst. ALE: font loading je asynchronní a `__PRINT_READY__` se nastaví dříve, než se fonty stáhnou.

### BUG 9: PRINTGRIDCANVAS PADDING NEODPOVÍDÁ GRIDCANVAS

GridCanvas content area:
```tsx
padding: PADDING,      // 24px (horizontální)
paddingTop: 16,         // 16px
paddingBottom: 16,      // 16px
```

PrintGridCanvas content area:
```tsx
padding: PADDING,      // 24px (horizontální)
paddingTop: 16,         // 16px
paddingBottom: 16,      // 16px
```

Tyto SE SHODUJÍ – ✅ to je OK. ALE: pokud se v budoucnu změní jedno, musí se změnit i druhé.

---

## FINÁLNÍ ŘEŠENÍ

### Principy:
1. **Žádný bleed wrapper** – Browserless produkuje čisté A4 stránky
2. **Každá stránka = jeden `<div>`** s přesně A4 rozměry (794×1123px) a `page-break-after: always`
3. **PrintPage** je čistý, minimální wrapper – jen fetch dat a render
4. **Žádné destruktivní CSS** – smazat/opravit index.css print pravidla
5. **Stabilizovaný render** – `__PRINT_READY__` se nastaví až po: fonty + ResizeObserver stabilizace
6. **Sdílené konstanty** – `page-layout.ts` zabrání divergenci mezi editorem a tiskem

### Krok 1: Vytvořit `src/utils/page-layout.ts`

```typescript
import { PageHeaderConfig, PageFooterConfig } from '../types/worksheet';
import { getHeaderHeight, getFooterHeight } from '../components/worksheet-editor-pro/PageHeaderFooter';

export const MM_TO_PX = 96 / 25.4;
export const SAFE_ZONE_MM = 5;
export const SAFE_ZONE_PX = Math.round(SAFE_ZONE_MM * MM_TO_PX); // 19px

export const PAGE_DIMENSIONS = {
  a4: { width: Math.round(210 * MM_TO_PX), height: Math.round(297 * MM_TO_PX) },
  b5: { width: Math.round(176 * MM_TO_PX), height: Math.round(250 * MM_TO_PX) },
  a5: { width: Math.round(148 * MM_TO_PX), height: Math.round(210 * MM_TO_PX) },
} as const;

export type PageFormat = 'a4' | 'b5' | 'a5';

export const CONTENT_PADDING_H = 24; // horizontální padding (> SAFE_ZONE_PX, OK)
export const CONTENT_PADDING_V = 16; // vertikální padding uvnitř content area

/**
 * Vypočítá výšku content area na stránce.
 * 
 * Pokud header/footer CHYBÍ, automaticky přidá safe zone padding,
 * aby obsah nezasahoval do 5mm od okraje papíru.
 */
export function getContentHeight(
  pageFormat: PageFormat,
  headerConfig?: PageHeaderConfig,
  footerConfig?: PageFooterConfig,
): number {
  const { height: pageHeight } = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
  const headerH = getHeaderHeight(headerConfig);
  const footerH = getFooterHeight(footerConfig);
  
  // Pokud je header vypnutý, jeho výška je 0 → paddingTop musí být alespoň SAFE_ZONE
  const topPad = headerH > 0 ? CONTENT_PADDING_V : Math.max(CONTENT_PADDING_V, SAFE_ZONE_PX);
  // Pokud je footer vypnutý, jeho výška je 0 → paddingBottom musí být alespoň SAFE_ZONE
  const botPad = footerH > 0 ? CONTENT_PADDING_V : Math.max(CONTENT_PADDING_V, SAFE_ZONE_PX);
  
  return pageHeight - headerH - footerH - topPad - botPad;
}

/**
 * Vrátí vertikální padding pro content area.
 * Pokud header/footer chybí, padding = safe zone.
 */
export function getContentPaddingV(
  headerConfig?: PageHeaderConfig,
  footerConfig?: PageFooterConfig,
): { top: number; bottom: number } {
  const headerH = getHeaderHeight(headerConfig);
  const footerH = getFooterHeight(footerConfig);
  return {
    top: headerH > 0 ? CONTENT_PADDING_V : Math.max(CONTENT_PADDING_V, SAFE_ZONE_PX),
    bottom: footerH > 0 ? CONTENT_PADDING_V : Math.max(CONTENT_PADDING_V, SAFE_ZONE_PX),
  };
}
```

**Proč takto:**
- Header/footer jsou VŽDY > 5mm (header = 60px = 16mm, footer = 56px = 15mm). Pokud existují, automaticky vytváří safe zone.
- Pokud NEEXISTUJÍ, content padding se zvýší na SAFE_ZONE_PX (19px ≈ 5mm).
- Horizontální padding je 24px = 6.3mm > 5mm, takže horizontálně je safe zone vždy splněna.
- Stávající editor layout se NEZMĚNÍ (header i footer jsou defaultně zapnuté).

### Krok 2: Opravit `index.css`

**SMAZAT** celou sekci 1 (řádky 5453–5580):
```css
@media print {
  header, aside, .print\:hidden { display: none !important; }
  body { color: #000 !important; background: #fff !important; font-size: 8pt !important; ... }
  h1 { font-size: 14pt !important; }
  /* ... celá sekce ... */
  .print\:border-gray-300 { border-color: #d1d5db !important; }
}
```
↑ Toto je 100% legacy pro dokumentační layout. Ničí VŠECHNY velikosti textu v worksheetu.

**V sekci 2 (řádky 5586–5704) SMAZAT pouze destruktivní řádky:**
```css
/* SMAZAT – ničí custom font velikosti */
.a4-page h1 { font-size: 19pt !important; font-family: "Cooper Light", serif !important; font-weight: 300 !important; }
.a4-page h2 { font-size: 12pt !important; font-weight: 700 !important; }
.a4-page h3 { font-size: 11pt !important; font-weight: 700 !important; }

/* SMAZAT – ničí VŠECHNY pozadí a borders v celém worksheetu */
.a4-page * {
  background: transparent !important;
  border-color: #cbd5e1 !important;
}

/* SMAZAT – zbytečné záplaty, které nefungují (editor používá inline styles) */
.a4-page .bg-blue-50 { background-color: #eff6ff !important; }
.a4-page .bg-green-50 { ... }
/* ... všechny .a4-page .bg-* a .border-* záplaty ... */
.a4-page .paragraph-infobox[data-bg-color="blue"] { ... }
/* ... všechny data-bg-color záplaty ... */
```

**PONECHAT z sekce 2:**
```css
@media print {
  @page { size: A4; margin: 0; }
  html, body { height: auto !important; overflow: visible !important; }
  body { font-family: "Fenomen Sans", ...; font-size: 10pt !important; line-height: 1.5 !important; color: #0f172a !important; }
  .top-controls, .left-toolbar, .right-toolbar, .pages-settings { display: none !important; }
  .center-area { padding: 0 !important; overflow: visible !important; height: auto !important; }
  .pages-row { margin: 0 !important; width: auto !important; overflow: visible !important; height: auto !important; }
  .resize-handle, .cursor-col-resize, .cursor-row-resize { display: none !important; }
  .choice-circle { ... }
  .activity-number-circle { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .a4-page { width: 210mm !important; min-height: 297mm !important; margin: 0 !important; box-shadow: none !important; ... page-break-after: always; }
  .a4-page:last-child { page-break-after: auto; }
  .overflow-hidden, .overflow-auto, .h-screen { overflow: visible !important; height: auto !important; }
}
```

**PŘIDAT na konec sekce 2** (globální color-adjust):
```css
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
```

### Krok 3: Přepsat `PrintGridCanvas.tsx`

Klíčové změny:
1. **Import sdílených konstant** z `page-layout.ts`
2. **Přidat `pageBreakAfter: 'always'`** na každou stránku (kromě poslední)
3. **Odebrat mezery** (`marginBottom: 40px` a separátor `<div style={{ height: 40px }}>`)
4. **Přidat třídu `a4-page`** na stránky (pro kompatibilitu s existujícími CSS print pravidly)
5. **Přidat `onStable` callback** – signalizuje, kdy jsou výšky stabilizované
6. **Vertikální padding přizpůsobit** pomocí `getContentPaddingV`

```tsx
import { PAGE_DIMENSIONS, CONTENT_PADDING_H as PADDING, getContentHeight, getContentPaddingV, PageFormat } from '../../utils/page-layout';

// ...

export function PrintGridCanvas({ worksheet, onStable }: PrintGridCanvasProps) {
  // ... (fetch metadata stejně jako teď)

  const contentHeight = getContentHeight(pageFormat, pageHeader, pageFooter);
  const { top: padTop, bottom: padBot } = getContentPaddingV(pageHeader, pageFooter);

  // Stabilization tracking
  const prevHeightsRef = useRef<string>('');
  const stableCountRef = useRef(0);
  const didSignalRef = useRef(false);
  
  useEffect(() => {
    const key = JSON.stringify(blockHeights);
    if (key === prevHeightsRef.current) {
      stableCountRef.current++;
    } else {
      stableCountRef.current = 0;
      prevHeightsRef.current = key;
    }
    // Po 2 identických cyklech považujeme za stabilní
    if (stableCountRef.current >= 1 && Object.keys(blockHeights).length > 0 && !didSignalRef.current) {
      didSignalRef.current = true;
      onStable?.();
    }
  }, [blockHeights, onStable]);

  // ... paginace (identická logika, ale contentHeight z page-layout.ts) ...

  return (
    <div ref={containerRef} style={{ width: `${pageWidth}px`, margin: '0 auto' }}>
      {pagesData.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="a4-page"
          style={{
            width: `${pageWidth}px`,
            height: `${pageHeight}px`,
            backgroundColor: pageBackgroundColor,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'none',
            pageBreakAfter: pageIndex < pagesData.length - 1 ? 'always' : 'auto',
            breakAfter: pageIndex < pagesData.length - 1 ? 'page' : 'auto',
            // ŽÁDNÝ marginBottom – stránky jdou těsně za sebou
          }}
        >
          <PageHeader config={pageHeader} padding={PADDING} style={{ flexShrink: 0 }} />
          
          <div style={{
            paddingLeft: PADDING,
            paddingRight: PADDING,
            paddingTop: padTop,
            paddingBottom: padBot,
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gap: `${gridGapPx}px`,
            alignItems: 'start',
            alignContent: 'start',
          }}>
            {/* bloky – identicky jako teď */}
          </div>

          <PageFooter config={pageFooter} pageNumber={page.pageNumber} totalPages={pagesData.length} padding={PADDING} style={{ flexShrink: 0 }} />
        </div>
        // ŽÁDNÝ separátor <div style={{ height: 40px }} /> mezi stránkami
      ))}
    </div>
  );
}
```

### Krok 4: Přepsat `PrintPage.tsx`

Kompletní zjednodušení:

```tsx
export function PrintPage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch worksheet data
  useEffect(() => {
    if (!worksheetId) { setError('Chybí ID'); setLoading(false); return; }
    (async () => {
      // 1. localStorage (okamžité, funguje v prohlížeči)
      const local = localStorage.getItem(`vividbooks_worksheet_${worksheetId}`);
      if (local) { try { setWorksheet(JSON.parse(local)); setLoading(false); return; } catch {} }
      // 2. get-worksheet edge function (service role, funguje v Browserless)
      const ws = await fetchWorksheetViaProxy(worksheetId);
      if (ws) { setWorksheet(ws); setLoading(false); return; }
      // 3. Fallback error
      setError('Pracovní list nebyl nalezen.');
      setLoading(false);
    })();
  }, [worksheetId]);

  // Signal ready ONLY after fonts + layout stabilization
  const handleStable = useCallback(() => {
    document.fonts.ready.then(() => {
      // Malý timeout pro jistotu – fonty jsou loaded, layout stabilní
      setTimeout(() => {
        (window as any).__PRINT_READY__ = true;
      }, 300);
    });
  }, []);

  const printStyles = `
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      width: ${PAGE_DIMENSIONS.a4.width}px;
    }
    @page {
      size: 210mm 297mm;
      margin: 0;
    }
    @media screen {
      html, body { background: #e5e7eb; }
      body { padding: 40px; display: flex; flex-direction: column; align-items: center; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      {loading && <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Načítám…</div>}
      {error && <div style={{ padding: 60, textAlign: 'center', color: '#ef4444' }}>{error}</div>}
      {worksheet && <PrintGridCanvas worksheet={worksheet} onStable={handleStable} />}
    </>
  );
}
```

**Co je pryč:**
- ❌ Bleed wrapper
- ❌ Crop marks
- ❌ Page-inset div
- ❌ Auth token forwarding
- ❌ Okamžité `__PRINT_READY__`

**Co je nové:**
- ✅ `onStable` callback z PrintGridCanvas
- ✅ `document.fonts.ready` čekání
- ✅ Čistý minimální CSS reset
- ✅ `body { width: 794px }` přesně odpovídá A4

### Krok 5: Opravit `pdf-export/index.ts`

```typescript
const browserlessBody = {
  url: printUrl,
  waitForFunction: {
    fn: '() => !!window.__PRINT_READY__',
    timeout: 45000,  // zvýšeno: fonty se mohou loadovat dlouho
  },
  gotoOptions: {
    waitUntil: 'networkidle0',  // čekat na NULOVOU síťovou aktivitu (fonty!)
    timeout: 45000,
  },
  options: {
    format: 'A4',              // ← STANDARDNÍ A4 (210×297mm)
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,   // ← použít @page { size } z CSS
  },
};
```

**Co se změnilo:**
- `format: 'A4'` místo custom `width: 220mm, height: 307mm`
- `preferCSSPageSize: true` – Puppeteer použije `@page { size: 210mm 297mm }` z CSS
- `waitUntil: 'networkidle0'` – čeká na NULOVOU síťovou aktivitu (= fonty staženy)
- timeout zvýšen na 45s (fonty mohou trvat déle)
- URL bez `?cropmarks=1` (crop marks jsou pryč)

### Krok 6: Aktualizovat `GridCanvas.tsx`

Import sdílených konstant:
```typescript
import { PAGE_DIMENSIONS, CONTENT_PADDING_H as PADDING, getContentHeight, getContentPaddingV } from '../../utils/page-layout';

// ODEBRAT lokální definice:
// const MM_TO_PX = ...
// const PAGE_DIMENSIONS = ...
// const PADDING = 24;

// V komponentě:
const contentHeight = getContentHeight(pageFormat, pageHeader, pageFooter);
const { top: padTop, bottom: padBot } = getContentPaddingV(pageHeader, pageFooter);
```

Vizuálně se editor NEZMĚNÍ (header i footer jsou defaultně zapnuté, padding zůstane 16px).

---

## KONTROLNÍ CHECKLIST – VŠECHNY USECASES

| Usecase | Řešení |
|---------|--------|
| Barvy pozadí infoboxů | ✅ Žádné `background: transparent !important` |
| Custom border colors | ✅ Žádné `border-color: #cbd5e1 !important` |
| Inline styles (ne tailwind třídy) | ✅ Žádné přepisování `.bg-*` tříd |
| Stíny (box-shadow) | ✅ `print-color-adjust: exact` zachová shadows |
| Fonty (Fenomen Sans, Cooper Light) | ✅ `networkidle0` + `document.fonts.ready` |
| Obrázky | ✅ `networkidle0` čeká na stažení obrázků |
| Activity number circles (barevné) | ✅ `print-color-adjust: exact` + ponechaný CSS pro `.activity-number-circle` |
| Header/Footer | ✅ Identické komponenty jako editor |
| Stránka 1 = PDF stránka 1 | ✅ `page-break-after: always` + `format: A4` |
| Safe zone 5mm (s headerem/footerem) | ✅ Header 60px (16mm), Footer 56px (15mm) > 5mm |
| Safe zone 5mm (BEZ headeru/footeru) | ✅ Padding zvýšen na 19px (5mm) automaticky |
| Blok přetéká přes stránku | ✅ Paginace přesune blok na další stránku |
| Více stránek → více PDF stránek | ✅ `page-break-after: always` na každé stránce |
| Správné zalomení textu | ✅ Stejné fonty, šířky, paddingy jako editor |
| ResizeObserver stabilizace | ✅ `onStable` callback po 2 identických cyklech |
| Ctrl+P tisk z prohlížeče | ✅ Ponechaná CSS pravidla v sekci 2 |
| Grid gap | ✅ Identická hodnota z metadata worksheetu |
| Custom font sizes (pt) | ✅ Žádné přepisování `font-size` v print CSS |

---

## SOUHRN ZMĚN

| Soubor | Akce |
|--------|------|
| `src/utils/page-layout.ts` | **NOVÝ** – sdílené konstanty, `getContentHeight()`, `getContentPaddingV()` |
| `src/index.css` | **EDITACE** – smazat sekci 1, v sekci 2 smazat destruktivní řádky, přidat `print-color-adjust` |
| `src/components/worksheet-editor-pro/PrintGridCanvas.tsx` | **PŘEPIS** – import z page-layout, page-break-after, onStable, žádné mezery |
| `src/components/worksheet-editor-pro/PrintPage.tsx` | **PŘEPIS** – žádný bleed/cropmarks, čeká na fonty+stabilizaci |
| `supabase/functions/pdf-export/index.ts` | **EDITACE** – format A4, preferCSSPageSize, networkidle0, timeout 45s |
| `src/components/worksheet-editor-pro/GridCanvas.tsx` | **EDITACE** – import z page-layout.ts (sdílené konstanty) |

## VÝSLEDEK

- Každá A4 stránka v editoru = přesně 1 PDF stránka (210×297mm)
- Design je 1:1 – EditableBlock se renderuje identicky v editoru i v PDF
- Všechny inline styly, barvy, pozadí, borders, stíny se zachovají
- Fonty se načtou před generováním PDF
- Layout je stabilizovaný (ResizeObserver) před generováním PDF
- Žádný obsah nezasahuje do 5mm safe zone
- Bloky, které by přetekly, se automaticky přesunou na další stránku
- Žádné destructivní CSS `!important` pravidla
