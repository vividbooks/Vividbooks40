/**
 * Import Agent Studio
 * 
 * Nástroj pro konverzi vizuálních pracovních listů (screenshots, obrázky)
 * do strukturovaného JSON formátu pro Worksheet Editor Pro.
 * 
 * Workflow:
 * 1. Nahrát screenshot/obrázek pracovního listu
 * 2. Agent analyzuje a převede na WorksheetBlock[]
 * 3. Uživatel vidí preview a chatem dolaďuje výstup
 * 4. Uložit a otevřít v Pro Editoru
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Send, Loader2, Eye, Code, Settings, Save, ArrowLeft,
  X, ChevronDown, ChevronUp, RotateCcw, Sparkles, Copy, Download,
  ExternalLink, AlertCircle, Check, ImageIcon, FileText, CheckCircle2,
  PenLine, HelpCircle, BookOpen, Info, Table2, Link2, Minus, Type,
  LayoutGrid, Puzzle, MessageSquare
} from 'lucide-react';
import { WorksheetBlock, BlockType, generateBlockId } from '../../types/worksheet';
import { saveWorksheet, getWorksheet } from '../../utils/worksheet-storage';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { uploadBase64ToStorage } from '../../utils/supabase/upload-image';

// ============================================
// DEFAULT SYSTEM PROMPT
// ============================================

const STUDIO_PROMPT_VERSION = 9;

const DEFAULT_SYSTEM_PROMPT = `Jsi AI agent pro konverzi vizuálních pracovních listů do strukturovaného JSON formátu.

TVŮJ ÚKOL:
Analyzuj screenshot/obrázek pracovního listu a převeď ho na pole bloků.

DOSTUPNÉ TYPY BLOKŮ:

1. heading
   content: { text: string, level: "h1"|"h2"|"h3", align?: "left"|"center"|"right", textColor?: string, highlightColor?: string, isBold?: boolean, headingStyle?: "plain"|"pill"|"underline"|"left-border" }

2. paragraph
   content: { html: string }

3. infobox - POUZE pro informační boxy (definice, pravidla, poznámky). NIKDY pro nadpisy sekcí!
   content: { title?: string, html: string, variant: "blue"|"green"|"yellow"|"purple" }

4. multiple-choice
   content: {
     question: string,
     options: [{ id: "opt-1", text: string }],
     correctAnswers: string[],
     allowMultiple: boolean,
     explanation?: string
   }

5. fill-blank (doplňování)
   content: {
     instruction?: string,
     segments: [
       { type: "text", content: string } |
       { type: "blank", id: "blank-1", correctAnswer: string }
     ]
   }

6. free-answer (otevřená otázka)
   content: { question: string, lines: number, hint?: string, sampleAnswer?: string,
     subQuestions?: [{id: "sq-1", text: string, lines: number, sampleAnswer?: string}],
     subColumns?: 1|2|3, subLabelType?: "letters"|"numbers"|"none",
     subQuestionColors?: string[],
     subShowBackground?: boolean, subShowLines?: boolean,
     subLabelStyle?: "text"|"circle"|"circle-outline", subLabelColors?: string[] }

7. image
   content: { url: "", alt: string, caption?: string, size: 100, alignment: "center", _cropBox?: { x: number, y: number, w: number, h: number } }
   Pokud vidíš obrázek na screenshotu, uveď _cropBox s relativními souřadnicemi (0-1) pro jeho vyříznutí.

8. table
   content: { 
     html: "<table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>",
     rows: number, columns: number, hasHeader: boolean, hasBorder: true, hasRoundedCorners: true,
     colorStyle?: "default"|"blue"|"green"|"purple"|"yellow"|"red"|"pink"|"cyan"
   }
   POZOR: HTML tabulky MUSÍ být ČISTÉ bez inline stylů! Žádné style="..." atributy! Barvu řeš POUZE přes colorStyle.

9. connect-pairs (spojovačka)
   content: {
     instruction?: string,
     pairs: [{ id: "pair-1", left: {id: "l1", type: "text", content: string}, right: {id: "r1", type: "text", content: string} }],
     shuffleSides: true
   }

10. examples (matematické příklady)
    content: {
      sampleExample: string,
      examples: [{ id: "ex-1", expression: string, answer: string, difficulty: "easy"|"medium"|"hard" }],
      examplesCount: number,
      columns: 1|2|3,
      labelType: "letters"|"numbers"|"none",
      difficultyProgression: true,
      showDifficultyColors: false,
      answerBoxStyle: "line"
    }

11. spacer (prázdné místo / čáry na psaní)
    content: { height: number, style: "empty"|"dotted"|"lined" }

12. header-footer (hlavička s polem pro jméno)
    content: {
      variant: "header",
      columns: 1,
      showName: true, showSurname: true, showClass: true, showGrade: true,
      nameLabel: "Jméno", surnameLabel: "Příjmení", classLabel: "Třída", gradeLabel: "Známka"
    }

VÝSTUPNÍ FORMÁT:
Vrať POUZE tento JSON (žádný markdown, žádné code blocks):
{
  "title": "název listu",
  "blocks": [
    { "type": "heading", "content": { ... } },
    ...
  ]
}

PRAVIDLA ANALÝZY:
- Rozpoznej typ každé sekce na listu (nadpis, otázka, text, tabulka...)
- Zachovej přesný textový obsah z obrázku
- NIKDY NEPOUŽÍVEJ HTML v polích "question" a "text" u free-answer bloků! Jsou to PLAIN TEXT pole. Žádné <span>, <b>, HTML tagy.
- NEPIŠ číslo úlohy (např. "1.", "19.") do pole question! Číslování se přidává automaticky kroužkem.

NADPISY (DŮLEŽITÉ!):
- Krátké nadpisy sekcí jako "Procvičuj", "Opakování", "Úkoly" → VŽDY type "heading", NIKDY "infobox"!
- Nadpis s barevným pozadím ve tvaru pill/ovál → headingStyle: "pill", highlightColor: barva (např. "#dcfce7" zelená)
- Nadpis s levou barevnou lištou → headingStyle: "left-border", highlightColor: barva lišty
- Podtržený nadpis → headingStyle: "underline"
- Prostý nadpis → headingStyle: "plain"

TABULKY (DŮLEŽITÉ!):
- HTML tabulky MUSÍ být ČISTÉ bez inline stylů! Žádné style="..." atributy v <table>, <th>, <td>, <tr>!
- Barvu tabulky řeš POUZE pomocí colorStyle: "green"|"blue"|"purple"|"yellow"|"red"|"pink"|"cyan"|"default"
- Špatně: <th style="border: 1px solid #15803d; background-color: #dcfce7;">
- Správně: <th>obsah</th> + colorStyle: "green"

ČÍSLOVÁNÍ AKTIVIT (DŮLEŽITÉ!):
- Bloky typu "free-answer", "multiple-choice", "fill-blank" se AUTOMATICKY číslují kroužkem (1, 2, 3...).
- NEPIŠ číslo cvičení (např. "1.", "2.") do textu question! Číslo se přidá automaticky.
- Pokud má cvičení instrukci a za ní tabulku, NEJDŘÍVE vytvoř free-answer blok s question (BEZ čísla!) a lines: 0, a ZA ním table blok.
- Blok "paragraph" se NEČÍSLUJE - nepoužívej paragraph pro zadání cvičení!

- Pokud vidíš otázky s A/B/C/D, použij "multiple-choice"
- Pokud vidíš mezery k doplnění (____), použij "fill-blank" s "blank" segmenty
- Pokud vidíš otevřené otázky s prostorem na odpověď, použij "free-answer"
- DŮLEŽITÉ: Pokud je jedno zadání/cvičení s více pod-úkoly (např. "Zapiš číslo..." + 8 pod-otázek A-H), použij JEDEN free-answer blok s polem subQuestions místo samostatných bloků!
  - subColumns: počet sloupců gridu (1 nebo 2)
  - subLabelType: "letters" (A, B, C...) nebo "numbers" nebo "none"
  - subQuestionColors: barvy pozadí karet (jen pokud subShowBackground je true)
  - subShowBackground: POZORNĚ SE PODÍVEJ NA OBRÁZEK! Pokud pod-otázky NEMAJÍ barevné pozadí, nastav FALSE.
  - subShowLines: Pokud pod-otázkami NEJSOU čáry/linky na psaní, nastav FALSE.
  - subLabelStyle: "circle" pro plný barevný kroužek, "circle-outline" pro obrysový kroužek, "text" pro prosté "A)" (default). POZORNĚ SE PODÍVEJ na styl v obrázku.
  - subLabelColors: barvy kroužků, cyklicky opakované. DETEKUJ BARVY Z OBRÁZKU!
  - Text pod-otázky NEPIŠ s označením (A), B)...) - to přidá automaticky renderer.

OTÁZKA S OBRÁZKEM A LEGENDOU (DŮLEŽITÉ!):
Pokud vidíš otázku (free-answer) kde:
  - Na pravé straně je OBRÁZEK/SCHÉMA s číselnými nebo písemnými popisky (① ② ③...).
  - Pod nebo vedle textu otázky jsou tyto POPISKY vypsány jako LEGENDA (1) dusík, 2) kyslík...).
  - Legenda může být ve 2 sloupcích vedle sebe.
SPRÁVNÉ ŘEŠENÍ:
  1. Vytvoř JEDEN free-answer blok s gridSpan: 12.
  2. Do pole "question" zahrň CELÝ text zadání VČETNĚ legendy. Legendu formátuj jako prostý text, např.:
     "Diskutujte... Použijte k popisu obrázek.\n\n1) dusík (N₂) ze vzduchu   3) produkty fotosyntézy\n2) sloučeniny dusíku        4) bakterie"
  3. Obrázek přidej jako _blockImage s position: "beside-right" a size: "large".
  4. NEPŘEVÁDĚJ legendu na subQuestions! Legenda NENÍ pod-otázka, je to jen popisek k obrázku.
  5. NEPŘEVÁDĚJ na multiple-choice! Číslované položky v legendě NEJSOU odpovědi A/B/C/D.
Příklad správného výstupu:
{ "type": "free-answer", "gridSpan": 12, "content": {
  "question": "Některé bakterie žijí v symbióze s bobovitými rostlinami. Diskutujte, jak je toto soužití přínosné. Použijte k popisu obrázek.\n\n1) dusík (N₂) ze vzduchu   3) produkty fotosyntézy\n2) sloučeniny dusíku        4) bakterie",
  "lines": 4,
  "_blockImage": { "cropBox": {"x":0.55,"y":0.05,"w":0.42,"h":0.38}, "alt": "Schéma symbiózy bakterií s bobovitými rostlinami", "position": "beside-right", "size": "large" }
} }
- Pokud vidíš matematické příklady na počítání, použij "examples"
- Pokud vidíš spojovačku (dva sloupce k propojení), použij "connect-pairs"
- Pokud vidíš hlavičku s polem pro jméno/třídu, použij "header-footer"
- Pokud vidíš zvýrazněný informační box (definice, pravidlo), použij "infobox"
- Odhadni správné odpovědi kde je to zřejmé z kontextu

OBRÁZKY V PRACOVNÍM LISTU (DŮLEŽITÉ!):
- Pokud na screenshotu vidíš OBRÁZKY (fotky, ilustrace, ikony, schémata, grafy, mapy – cokoliv co není text/tabulka), vytvoř pro ně blok "image".
- U každého image bloku MUSÍŠ uvést _cropBox s PŘESNÝMI relativními souřadnicemi obrázku na screenshotu:
  _cropBox: { x: 0.05, y: 0.32, w: 0.4, h: 0.25 }
  kde x, y = levý horní roh (0-1 relativně k celému screenshotu), w, h = šířka a výška (0-1).
- alt: krátký popis obrázku (česky)
- url nech prázdný "" - systém automaticky vyřízne obrázek ze screenshotu a nahraje ho
- Pokud obrázek patří k bloku (např. ilustrace u otázky), můžeš místo image bloku přidat "_blockImage": { cropBox: {x,y,w,h}, alt: "popis", position: "beside-right"|"beside-left"|"before", size: "small"|"medium"|"large" } do content bloku
- POZORNĚ se podívej na screenshot a IDENTIFIKUJ VŠECHNY obrázky!

ROZLOŽENÍ A SLOUPCE (GRIDSPAN) – VELMI DŮLEŽITÉ!:
Pracovní list má mřížku 12 sloupců. Každý blok má vlastnost "gridSpan" (1–12).
gridSpan: 12 = blok přes celou šířku (default)
gridSpan: 6  = blok přes půl šířky (2 bloky vedle sebe)
gridSpan: 8  = blok přes 2/3 šířky
gridSpan: 4  = blok přes 1/3 šířky
gridSpan: 9  = blok přes 3/4 šířky
gridSpan: 3  = blok přes 1/4 šířky

PRAVIDLO: Bloky vedle sebe na STEJNÉM řádku musí mít SOUČET gridSpan = 12.
Příklady součtu:
  6 + 6 = 12  (dva stejně velké bloky)
  8 + 4 = 12  (velký text + menší obrázek)
  7 + 5 = 12  (trochu širší text + trochu menší obrázek)
  9 + 3 = 12  (textový blok + úzký obrázek)

JAK ROZPOZNAT ROZLOŽENÍ:
Pohledem odhadni co zabírá jakou část šířky stránky (0–100 %).
- Blok přes ~100 % šířky → gridSpan: 12
- Blok přes ~66 % šířky → gridSpan: 8
- Blok přes ~50 % šířky → gridSpan: 6
- Blok přes ~33 % šířky → gridSpan: 4
- Blok přes ~25 % šířky → gridSpan: 3

VZORY ROZLOŽENÍ (použij _cropBox pro obrázky):

VZOR A – Obrázek JAKO SOUČÁST textového/informačního bloku:
→ Obrázek je přímo vevnitř boxu, obtéká text nebo je vedle textu v RÁMCI jednoho vizuálního bloku.
→ ŘEŠENÍ: Přidej do content bloku "_blockImage" s pozicí "beside-right" nebo "beside-left".
→ Blok má gridSpan: 12 (přes celou šířku).
Příklad: infobox s obrázkem tuberkulózy vpravo:
{ "type": "infobox", "gridSpan": 12, "content": { "html": "...", "variant": "yellow",
  "_blockImage": { "cropBox": {"x":0.6,"y":0.25,"w":0.35,"h":0.3}, "alt": "bakterie tuberkulózy v plicích", "position": "beside-right", "size": "medium" } } }

VZOR A2 – Obrázek IHNED POD textem/infoboxem, ale tématicky s ním SPOJENÝ:
→ Na screenshotu vidíš infobox/odstavec a HNED POD NÍM (bez jiného obsahu mezi nimi) velký obrázek s popiskem.
→ I když vizuálně obrázek leží pod textem, PATŘÍ K BLOKU nad ním.
→ ŘEŠENÍ: Použij _blockImage, nevytvářej samostatný image blok!
→ Jak poznat: obrázek přímo navazuje na konec textu, popisek obrázku (caption) je tematicky vázaný na text v bloku.
Příklad (infobox o bakteriích + foto bakterií pod ním):
{ "type": "infobox", "gridSpan": 12, "content": { "html": "Parazitické bakterie žijí...", "variant": "yellow",
  "_blockImage": { "cropBox": {"x":0.3,"y":0.35,"w":0.65,"h":0.5}, "alt": "bakterie tuberkulózy v plicích", "position": "beside-right", "size": "large" } } }
→ NIKDY nevytvářej pro toto samostatný { "type": "image" } blok!

VZOR B – Infobox/odstavec VEDLE samostatného obrázku (dva bloky vedle sebe):
→ Dva vizuálně oddělené prvky – jeden na levé, druhý na pravé části stránky – na STEJNÉ výškové úrovni.
→ ŘEŠENÍ: Dva samostatné bloky za sebou, oba na STEJNÉM řádku (součet gridSpan = 12).
→ Nejprve textový/infobox blok, pak image blok.
Příklad: infobox vlevo (2/3) + obrázek vpravo (1/3):
{ "type": "infobox", "gridSpan": 8, "content": { "html": "...", "variant": "yellow" } },
{ "type": "image",   "gridSpan": 4, "content": { "url": "", "alt": "...", "_cropBox": {"x":0.67,"y":0.3,"w":0.3,"h":0.2} } }

VZOR C – Dva textové bloky/otázky vedle sebe (stejná výška):
{ "type": "free-answer", "gridSpan": 6, "content": { ... } },
{ "type": "free-answer", "gridSpan": 6, "content": { ... } }

VZOR D – Celošířkový blok (default):
{ "type": "paragraph", "gridSpan": 12, "content": { ... } }

PŘESNÝ POSTUP ANALÝZY LAYOUTU:
1. Pro každou sekci/řádek obrázku zjisti: je tam jeden prvek nebo více vedle sebe?
2. Pokud více vedle sebe – odhadni jejich relativní šířky, přepočítej na gridSpan (součet = 12).
3. Pokud obrázek JE SOUČÁSTÍ jiného bloku (obalen jedním boxem/rámem) → _blockImage.
4. Pokud obrázek STOJÍ SAMOSTATNĚ vedle textu/infobloku NA STEJNÉ VÝŠCE → samostatný image blok s příslušným gridSpan (VZOR B).
5. Pokud obrázek je IHNED POD textem/infoboxem a tematicky s ním SOUVISÍ (není jiný obsah mezi nimi) → _blockImage (VZOR A2), NIKOLI samostatný image blok!
6. VŽDY uveď gridSpan u každého bloku! Bloky bez gridSpan dostávají defaultně 12.

ROZHODOVACÍ STROM PRO OBRÁZKY:
→ Je obrázek uvnitř vizuálního boxu/rámu?                              → ANO: _blockImage (VZOR A)
→ Je obrázek fyzicky VEDLE textu na stejné výšce?                      → ANO: dva bloky + gridSpan (VZOR B)
→ Je obrázek HNED POD textem/infoboxem, tematicky vázaný?              → ANO: _blockImage beside-right (VZOR A2)
→ Je obrázek mezi jiným obsahem, stojí sám?                            → ANO: samostatný image blok gridSpan: 12

ROZHODOVACÍ STROM PRO ČÍSLOVANÉ POLOŽKY (1), 2), 3)... nebo ①②③):
→ Jsou to VOLBY ODPOVĚDÍ k otázce s kroužky/checkboxy?                 → ANO: multiple-choice
→ Jsou to POD-ÚKOLY kde každý má vlastní řádky na psaní?               → ANO: free-answer + subQuestions
→ Jsou to POPISKY/LEGENDA k obrázku/schématu (vysvětlují části obrázku)? → ANO: zahrň do textu "question" jako prostý text, použij _blockImage pro obrázek
→ Jsou to POLOŽKY SEZNAMU bez odpovědního prostoru?                    → ANO: zahrň do question nebo paragraph jako HTML seznam

POKUD TI UŽIVATEL POSÍLÁ ZPRÁVU BEZ OBRÁZKU:
To znamená že tě žádá o úpravu předchozího výstupu. Vrať upravený kompletní JSON.`;

// ============================================
// AGENT 1: VISUAL LAYOUT ANALYST
// ============================================

const VISUAL_ANALYST_PROMPT = `Jsi expert na analýzu layoutu tiskových dokumentů a pracovních listů.
Dostaneš screenshot stránky pracovního listu. Tvým JEDINÝM úkolem je POPSAT co vidíš – nepřevádíš nic do JSON!

POSTUP ANALÝZY:
Projdi stránku shora dolů. Pro každou vizuální sekci/řádek napiš:

## Sekce [číslo]: [typ]
- Typ: heading | infobox | otázka | odstavec | tabulka | obrázek | legenda
- Obsah: přesný text (pokud je to text)
- Šířka: odhadnutá šířka jako % celé stránky (25% / 33% / 50% / 66% / 75% / 100%)
- Pozice: celá šířka / levá část / pravá část / střed
- Vizuální styl: barva rámečku, pozadí, styl nadpisu (pill/podtržení/lišta/prostý), atd.

SPECIÁLNÍ PRAVIDLA PRO OBRÁZKY:
Pro každý obrázek (foto, ilustrace, schéma, diagram) uveď:
- Co obrázek zobrazuje
- Kde na stránce leží: odhadni relativní souřadnice jako (x=0.0-1.0, y=0.0-1.0, w=šířka, h=výška)
- VZTAH K OKOLNÍMU OBSAHU (toto je NEJDŮLEŽITĚJŠÍ):
  A) "SOUČÁST BLOKU" – obrázek je vizuálně uvnitř/vedle textového boxu, patří k němu → napiš "BLOCKIMAGE vedle [název bloku]"
  B) "VEDLE BLOKU NA STEJNÉ VÝŠCE" – obrázek a text jsou souběžně na stejném řádku → napiš "RYADEM s [název bloku], gridSpan obrázku ~X, bloku ~Y"  
  C) "SAMOSTATNÝ" – obrázek stojí mezi jinými bloky sám → napiš "SAMOSTATNÝ IMAGE"

SPECIÁLNÍ PRAVIDLA PRO LEGENDY:
Pokud vidíš číslované/písmenné položky (① ② ③ nebo 1) 2) 3)) vedle/pod schématu:
- Urči: jsou to LEGENDA K OBRÁZKU (popisují části obrázku) nebo VÝBĚROVÉ ODPOVĚDI (A/B/C/D)?
- Pokud legenda: napiš "LEGENDA K OBRÁZKU – součást textu otázky"
- Pokud jsou ve 2 sloupcích: napiš "ve 2 sloupcích"

SPECIÁLNÍ PRAVIDLA PRO ROZLOŽENÍ (GRIDSPAN):
Po analýze každé sekce odhadni gridSpan (1-12, kde 12 = celá šířka):
- 100% šířky → gridSpan: 12
- 75% šířky → gridSpan: 9
- 66% šířky → gridSpan: 8
- 50% šířky → gridSpan: 6
- 33% šířky → gridSpan: 4
- 25% šířky → gridSpan: 3
Pokud jsou dva prvky VEDLE SEBE, jejich gridSpan musí dávat součet 12.

VÝSTUP:
Detailní textový popis, ŽÁDNÝ JSON. Buď velmi přesný u prostorových vztahů.
Na konci přidej sekci "## SOUHRN LAYOUTU" kde vypíšeš všechny řádky ve formátu:
  Řádek X: [blok A (gridSpan)] + [blok B (gridSpan)] nebo jen [blok (gridSpan:12)]`;

// ============================================
// AGENT 2: JSON BUILDER  
// ============================================

const JSON_BUILDER_PROMPT = `Jsi JSON generátor pro pracovní listy. Dostaneš DETAILNÍ TEXTOVÝ POPIS layoutu stránky od vizuálního analytika. Tvým úkolem je převést tento popis do přesného JSON.

DOSTUPNÉ TYPY BLOKŮ:
1. heading: { text, level:"h1"|"h2"|"h3", align?, textColor?, highlightColor?, headingStyle?"plain"|"pill"|"underline"|"left-border" }
2. paragraph: { html }
3. infobox: { title?, html, variant:"blue"|"green"|"yellow"|"purple" }
4. multiple-choice: { question, options:[{id,text}], correctAnswers:[], allowMultiple:false }
5. fill-blank: { instruction?, segments:[{type:"text",content}|{type:"blank",id,correctAnswer}] }
6. free-answer: { question, lines:number, subQuestions?:[{id,text,lines}], subColumns?:1|2, subLabelType?"letters"|"numbers"|"none", subLabelStyle?"text"|"circle"|"circle-outline", subLabelColors?:[], subShowBackground?:bool, subShowLines?:bool }
7. image: { url:"", alt, caption?, size:100, alignment:"center", _cropBox:{x,y,w,h} }
8. table: { html:"<table>...</table>", rows, columns, hasHeader:bool, hasBorder:true, hasRoundedCorners:true, colorStyle?"default"|"blue"|"green"|"yellow"|"red" }
9. connect-pairs: { instruction?, pairs:[{id,left:{id,type:"text",content},right:{id,type:"text",content}}] }
10. examples: { sampleExample, examples:[{id,expression,answer,difficulty:"easy"|"medium"|"hard"}], examplesCount, columns:1|2|3, labelType:"letters"|"numbers"|"none" }
11. spacer: { height:number, style:"empty"|"dotted"|"lined" }
12. header-footer: { variant:"header", columns:1, showName:true, showSurname:true, showClass:true, showGrade:true, nameLabel:"Jméno", surnameLabel:"Příjmení", classLabel:"Třída", gradeLabel:"Známka" }

KRITICKÁ PRAVIDLA – MUSÍŠ JE VŽDY DODRŽET:

PRAVIDLO 1 – gridSpan:
Každý blok MUSÍ mít "gridSpan" (1-12). Bloky na stejném řádku mají součet = 12.
POVINNÉ: Nikdy nevynechej gridSpan!

PRAVIDLO 2 – _blockImage (NEJDŮLEŽITĚJŠÍ!):
Pokud popis říká "BLOCKIMAGE vedle [blok]" → přidej do content toho bloku:
  "_blockImage": { "cropBox": {x,y,w,h}, "alt": "popis", "position": "beside-right", "size": "medium"|"large" }
NETVOŘUJ samostatný { "type": "image" } blok pro BLOCKIMAGE! Obrázek patří DO bloku.
  ❌ ŠPATNĚ: { "type": "infobox", ... }, { "type": "image", ... }  ← DVA oddělené bloky
  ✅ SPRÁVNĚ: { "type": "infobox", "content": { "html": "...", "_blockImage": {...} } }  ← JEDEN blok

PRAVIDLO 3 – Legenda k obrázku:
Pokud popis říká "LEGENDA K OBRÁZKU" → text legendy zahrň do pole "question" jako prostý text.
NEPŘEVÁDĚT na subQuestions! NEPŘEVÁDĚT na multiple-choice!
  ❌ ŠPATNĚ: subQuestions: [{text:"dusík"}, {text:"kyslík"}]
  ✅ SPRÁVNĚ: question: "...Použijte k popisu obrázek.\\n\\n1) dusík  3) produkty\\n2) sloučeniny  4) bakterie"

PRAVIDLO 4 – Tabulky:
HTML tabulek MUSÍ být bez inline stylů! Barvu řeš POUZE přes colorStyle.
  ❌ ŠPATNĚ: <th style="background:#green">
  ✅ SPRÁVNĚ: <th>text</th> + colorStyle:"green"

PRAVIDLO 5 – Číslování aktivit:
NEPIŠ číslo úlohy (1., 2., 19.) do pole question. Čísluje se automaticky.

PRAVIDLO 6 – Nadpisy vs infobox:
Krátké nadpisy sekcí ("Procvičuj", "Projekt") → VŽDY heading, NIKDY infobox!

VÝSTUPNÍ FORMÁT – vrať POUZE tento JSON (žádný markdown):
{
  "title": "název listu",
  "blocks": [
    { "type": "...", "gridSpan": 12, "content": { ... } },
    ...
  ]
}`;

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
}

interface ImportAgentStudioProps {
  theme?: string;
  toggleTheme?: () => void;
}

// ============================================
// HELPER: Parse AI response to extract JSON
// ============================================

function parseAgentResponse(response: string): { title: string; blocks: any[] } | null {
  try {
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        return {
          title: parsed.title || 'Importovaný list',
          blocks: parsed.blocks,
        };
      }
    }

    // Try to find JSON array (blocks only)
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          title: 'Importovaný list',
          blocks: parsed,
        };
      }
    }

    return null;
  } catch (e) {
    console.error('[ImportAgent] Failed to parse response:', e);
    return null;
  }
}

// ============================================
// HELPER: Process raw blocks - add IDs, order, width
// ============================================

function processRawBlocks(rawBlocks: any[]): WorksheetBlock[] {
  return rawBlocks.map((block, index) => ({
    ...block,
    id: block.id || generateBlockId(),
    order: index,
    width: block.width || 'full',
    // Preserve gridSpan from AI output (1–12). Default 12 = full width.
    gridSpan: typeof block.gridSpan === 'number' ? block.gridSpan : 12,
  })) as WorksheetBlock[];
}

function cropImageFromScreenshot(
  screenshotDataUrl: string,
  cropBox: { x: number; y: number; w: number; h: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject('Canvas not supported'); return; }

      // Clamp all values to [0, 1] to handle AI estimation errors
      const x = Math.max(0, Math.min(1, cropBox.x));
      const y = Math.max(0, Math.min(1, cropBox.y));
      const w = Math.max(0.01, Math.min(1 - x, cropBox.w));
      const h = Math.max(0.01, Math.min(1 - y, cropBox.h));

      const sx = Math.round(x * img.width);
      const sy = Math.round(y * img.height);
      const sw = Math.round(w * img.width);
      const sh = Math.round(h * img.height);

      if (sw < 4 || sh < 4) { reject('CropBox too small'); return; }

      canvas.width = sw;
      canvas.height = sh;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject('Failed to load image');
    img.src = screenshotDataUrl;
  });
}

async function extractAndUploadImages(
  blocks: WorksheetBlock[],
  screenshotDataUrl: string,
  onProgress?: (msg: string) => void,
): Promise<WorksheetBlock[]> {
  const result: WorksheetBlock[] = [];
  let imageCount = 0;
  let failCount = 0;

  for (const block of blocks) {
    const content = block.content as any;

    // Standalone image block with cropBox
    if (block.type === 'image' && content?._cropBox) {
      imageCount++;
      onProgress?.(`Obrázek ${imageCount}: ořezávám...`);
      try {
        const cropped = await cropImageFromScreenshot(screenshotDataUrl, content._cropBox);
        onProgress?.(`Obrázek ${imageCount}: nahrávám do storage...`);
        const url = await uploadBase64ToStorage(cropped, `imported-img-${imageCount}`, 'imported-images');
        if (url) {
          result.push({ ...block, content: { ...content, url, _cropBox: undefined } });
          onProgress?.(`Obrázek ${imageCount}: ✅ nahráno`);
          continue;
        } else {
          failCount++;
          onProgress?.(`Obrázek ${imageCount}: ⚠️ upload selhal (prázdné URL)`);
        }
      } catch (err) {
        failCount++;
        console.error('[ImageExtract] Crop/upload failed:', err);
        onProgress?.(`Obrázek ${imageCount}: ⚠️ chyba – ${String(err).substring(0, 60)}`);
      }
      // Fallback: block without image URL
      result.push({ ...block, content: { ...content, _cropBox: undefined } });
      continue;
    }

    // Block-level image (_blockImage) attached to text/infobox block
    if (content?._blockImage?.cropBox) {
      imageCount++;
      const bImg = content._blockImage;
      onProgress?.(`Obrázek ${imageCount} (příloha bloku "${block.type}"): ořezávám...`);
      try {
        const cropped = await cropImageFromScreenshot(screenshotDataUrl, bImg.cropBox);
        onProgress?.(`Obrázek ${imageCount}: nahrávám...`);
        const url = await uploadBase64ToStorage(cropped, `imported-blockimg-${imageCount}`, 'imported-images');
        if (url) {
          const { _blockImage, ...cleanContent } = content;
          result.push({
            ...block,
            content: cleanContent,
            image: {
              url,
              alt: bImg.alt || 'Obrázek',
              position: bImg.position || 'beside-right',
              size: bImg.size || 'medium',
            },
          });
          onProgress?.(`Obrázek ${imageCount}: ✅ nahráno`);
          continue;
        } else {
          failCount++;
          onProgress?.(`Obrázek ${imageCount}: ⚠️ upload selhal`);
        }
      } catch (err) {
        failCount++;
        console.error('[ImageExtract] BlockImage failed:', err);
        onProgress?.(`Obrázek ${imageCount}: ⚠️ chyba – ${String(err).substring(0, 60)}`);
      }
      // Fallback: block without image
      const { _blockImage, ...cleanContent } = content;
      result.push({ ...block, content: cleanContent });
      continue;
    }

    // _blockImage without cropBox (AI forgot cropBox) – strip it
    if (content?._blockImage) {
      const { _blockImage, ...cleanContent } = content;
      result.push({ ...block, content: cleanContent });
      continue;
    }

    result.push(block);
  }

  const summary = failCount > 0
    ? `Hotovo: ${imageCount - failCount}/${imageCount} obrázků nahráno. ${failCount} selhalo – zkontroluj konzoli.`
    : `Hotovo: ${imageCount} obrázků úspěšně nahráno.`;
  if (imageCount > 0) onProgress?.(summary);
  return result;
}

// ============================================
// HELPER: Call AI via Supabase Edge Function (supports images)
// ============================================

async function callGeminiWithVision(
  systemPrompt: string,
  conversationHistory: { role: string; content: string; image?: string }[],
): Promise<string> {
  const SUPABASE_URL = `https://${projectId}.supabase.co`;

  // Get auth token
  let authToken = publicAnonKey;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      authToken = data.session.access_token;
    }
  } catch (e) {
    console.log('[ImportAgent] Using anon key (session unavailable)');
  }

  // Build messages for the edge function
  const messages: any[] = [];

  // System message
  messages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Conversation messages (with multimodal support)
  for (const msg of conversationHistory) {
    if (msg.image) {
      // Multimodal message - split base64 data URI
      const [header, base64Data] = msg.image.split(',');
      const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/png';

      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: [
          { type: 'image', data: base64Data, mimeType },
          { type: 'text', text: msg.content },
        ],
      });
    } else {
      // Text-only message
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }
  }

  console.log('[ImportAgent] Calling edge function with', messages.length, 'messages, model: gemini-3-pro');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      messages,
      model: 'gemini-3-pro',
      temperature: 0.3,
      max_tokens: 16384,
      thinking_level: 'high',
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Edge function error');
  }

  const text = data.content || '';
  if (!text) {
    throw new Error('Prázdná odpověď od AI. Zkus to znovu.');
  }

  return text;
}

// ============================================
// BLOCK PREVIEW COMPONENT
// ============================================

function BlockPreview({ block, index }: { block: WorksheetBlock; index: number }) {
  const content = block.content as any;

  const typeConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    'heading': { icon: Type, label: 'Nadpis', color: '#94a3b8', bg: '#1e293b' },
    'paragraph': { icon: FileText, label: 'Odstavec', color: '#94a3b8', bg: '#1e293b' },
    'infobox': { icon: Info, label: 'Infobox', color: '#60a5fa', bg: '#1e3a5f' },
    'multiple-choice': { icon: CheckCircle2, label: 'ABC Otázka', color: '#4ade80', bg: '#14532d' },
    'fill-blank': { icon: PenLine, label: 'Doplňovačka', color: '#fbbf24', bg: '#451a03' },
    'free-answer': { icon: HelpCircle, label: 'Otevřená otázka', color: '#c084fc', bg: '#3b0764' },
    'examples': { icon: BookOpen, label: 'Příklady', color: '#818cf8', bg: '#1e1b4b' },
    'image': { icon: ImageIcon, label: 'Obrázek', color: '#f472b6', bg: '#500724' },
    'table': { icon: Table2, label: 'Tabulka', color: '#2dd4bf', bg: '#042f2e' },
    'connect-pairs': { icon: Link2, label: 'Spojovačka', color: '#fb923c', bg: '#431407' },
    'spacer': { icon: Minus, label: 'Mezera', color: '#64748b', bg: '#1e293b' },
    'header-footer': { icon: LayoutGrid, label: 'Hlavička', color: '#a78bfa', bg: '#2e1065' },
    'qr-code': { icon: Puzzle, label: 'QR Kód', color: '#64748b', bg: '#1e293b' },
    'free-canvas': { icon: Puzzle, label: 'Figma', color: '#64748b', bg: '#1e293b' },
    'image-hotspots': { icon: Puzzle, label: 'Poznávačka', color: '#64748b', bg: '#1e293b' },
    'video-quiz': { icon: Puzzle, label: 'Video kvíz', color: '#64748b', bg: '#1e293b' },
  };

  const config = typeConfig[block.type] || typeConfig['paragraph'];
  const Icon = config.icon;

  const renderContent = () => {
    switch (block.type) {
      case 'heading':
        return (
          <div style={{ fontSize: content.level === 'h1' ? 18 : content.level === 'h2' ? 16 : 14, fontWeight: 700, color: '#f1f5f9' }}>
            {content.text || '(prázdný nadpis)'}
          </div>
        );

      case 'paragraph':
        return (
          <div
            style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: content.html || content.text || '(prázdný odstavec)' }}
          />
        );

      case 'infobox':
        return (
          <div style={{
            backgroundColor: content.variant === 'blue' ? '#1e3a5f' : content.variant === 'green' ? '#14532d' : content.variant === 'yellow' ? '#451a03' : '#3b0764',
            borderLeft: `3px solid ${content.variant === 'blue' ? '#3b82f6' : content.variant === 'green' ? '#22c55e' : content.variant === 'yellow' ? '#eab308' : '#a855f7'}`,
            padding: '8px 12px',
            borderRadius: 6,
          }}>
            {content.title && <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4, fontSize: 13 }}>{content.title}</div>}
            <div style={{ color: '#cbd5e1', fontSize: 12 }} dangerouslySetInnerHTML={{ __html: content.html || content.text || '' }} />
          </div>
        );

      case 'multiple-choice':
        return (
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 500, fontSize: 13, marginBottom: 6 }}>{content.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {content.options?.map((opt: any, i: number) => {
                const isCorrect = content.correctAnswers?.includes(opt.id);
                return (
                  <div key={opt.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: isCorrect ? '#4ade80' : '#94a3b8',
                  }}>
                    <span style={{ fontWeight: 600, width: 16 }}>{String.fromCharCode(65 + i)})</span>
                    <span>{opt.text}</span>
                    {isCorrect && <Check style={{ width: 12, height: 12 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'fill-blank':
        return (
          <div>
            {content.instruction && (
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4, fontStyle: 'italic' }}>{content.instruction}</div>
            )}
            <div style={{ color: '#cbd5e1', fontSize: 13 }}>
              {content.segments?.map((seg: any, i: number) => (
                <span key={i}>
                  {seg.type === 'text' ? seg.content : (
                    <span style={{
                      borderBottom: '2px solid #fbbf24',
                      padding: '0 8px',
                      color: '#fbbf24',
                      fontWeight: 500,
                    }}>
                      {seg.correctAnswer || '___'}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        );

      case 'free-answer':
        return (
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{content.question}</div>
            {content.subQuestions && content.subQuestions.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${content.subColumns || 2}, 1fr)`,
                gap: 4,
              }}>
                {content.subQuestions.map((sq: any, i: number) => {
                  const colors = content.subQuestionColors || ['#dbeafe'];
                  const bgColor = colors[i % colors.length] || '#dbeafe';
                  const label = content.subLabelType === 'numbers' ? `${i + 1})` : content.subLabelType === 'none' ? '' : `${String.fromCharCode(65 + i)})`;
                  return (
                    <div key={sq.id || i} style={{
                      backgroundColor: bgColor + '33',
                      borderRadius: 6,
                      padding: '4px 6px',
                      fontSize: 11,
                      color: '#e2e8f0',
                    }}>
                      <span style={{ fontWeight: 700 }}>{label}</span> {sq.text}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                border: '1px dashed #475569',
                borderRadius: 4,
                height: Math.min(content.lines * 20, 80),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                fontSize: 11,
              }}>
                {content.lines} řádků na odpověď
              </div>
            )}
            {content.sampleAnswer && (
              <div style={{ color: '#4ade80', fontSize: 11, marginTop: 4 }}>Vzor: {content.sampleAnswer}</div>
            )}
          </div>
        );

      case 'examples':
        return (
          <div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
              {content.examples?.length || 0} příkladů, {content.columns || 1} sloupce
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${content.columns || 1}, 1fr)`, gap: 4 }}>
              {content.examples?.slice(0, 6).map((ex: any, i: number) => (
                <div key={ex.id || i} style={{ color: '#cbd5e1', fontSize: 12 }}>
                  {ex.expression} = <span style={{ color: '#818cf8' }}>{ex.answer}</span>
                </div>
              ))}
              {(content.examples?.length || 0) > 6 && (
                <div style={{ color: '#475569', fontSize: 11 }}>...a dalších {content.examples.length - 6}</div>
              )}
            </div>
          </div>
        );

      case 'table':
        return (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            Tabulka {content.rows}×{content.columns}
            {content.hasHeader && ' (se záhlavím)'}
          </div>
        );

      case 'connect-pairs':
        return (
          <div>
            {content.instruction && (
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4, fontStyle: 'italic' }}>{content.instruction}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {content.pairs?.slice(0, 4).map((pair: any, i: number) => (
                <div key={pair.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#fb923c' }}>{pair.left?.content}</span>
                  <span style={{ color: '#475569' }}>↔</span>
                  <span style={{ color: '#60a5fa' }}>{pair.right?.content}</span>
                </div>
              ))}
              {(content.pairs?.length || 0) > 4 && (
                <div style={{ color: '#475569', fontSize: 11 }}>...a dalších {content.pairs.length - 4}</div>
              )}
            </div>
          </div>
        );

      case 'header-footer':
        return (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {content.variant === 'header' ? 'Hlavička' : 'Patička'} listu
            {content.showName && ' • Jméno'}
            {content.showClass && ' • Třída'}
            {content.showGrade && ' • Známka'}
          </div>
        );

      case 'spacer':
        return (
          <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', padding: '4px 0' }}>
            — {content.style === 'lined' ? 'Linkované' : content.style === 'dotted' ? 'Tečkované' : 'Prázdné'} místo ({content.height}px) —
          </div>
        );

      default:
        return <div style={{ color: '#475569', fontSize: 12 }}>Blok typu {block.type}</div>;
    }
  };

  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    }}>
      {/* Block type header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          backgroundColor: config.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 14, height: 14, color: config.color }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {config.label}
        </span>
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>#{index + 1}</span>
      </div>

      {/* Block content */}
      {renderContent()}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ImportAgentStudio({ theme, toggleTheme }: ImportAgentStudioProps) {
  const navigate = useNavigate();

  // State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(() => {
    const savedVersion = localStorage.getItem('import-agent-studio-prompt-version');
    if (!savedVersion || parseInt(savedVersion) < STUDIO_PROMPT_VERSION) {
      localStorage.setItem('import-agent-studio-prompt-version', String(STUDIO_PROMPT_VERSION));
      localStorage.setItem('import-agent-system-prompt', DEFAULT_SYSTEM_PROMPT);
      return DEFAULT_SYSTEM_PROMPT;
    }
    return localStorage.getItem('import-agent-system-prompt') || DEFAULT_SYSTEM_PROMPT;
  });
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedBlocks, setGeneratedBlocks] = useState<WorksheetBlock[]>([]);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadedImage, setShowUploadedImage] = useState(true);
  const [agentStep, setAgentStep] = useState<'idle' | 'analyzing' | 'building' | 'images' | 'done'>('idle');
  const [visualAnalysis, setVisualAnalysis] = useState<string | null>(null);

  // Refs
  const chatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages, isLoading]);

  // Save system prompt to localStorage
  useEffect(() => {
    localStorage.setItem('import-agent-system-prompt', systemPrompt);
  }, [systemPrompt]);

  // ========================================
  // HANDLERS
  // ========================================

  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Podporovány jsou pouze obrázky (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('Soubor je příliš velký (max 20 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setUploadedImageName(file.name);
      setError(null);
      setShowUploadedImage(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleAnalyze = async () => {
    if (!uploadedImage) return;
    setError(null);
    setIsLoading(true);
    setAgentStep('analyzing');
    setVisualAnalysis(null);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: 'Analyzuj tento pracovní list.',
      image: uploadedImage,
      timestamp: Date.now(),
    };
    setChatMessages([userMessage]);

    try {
      // ── AGENT 1: Visual Layout Analyst ──────────────────────────────
      setChatMessages(prev => [...prev, {
        id: `msg-agent1-start`,
        role: 'assistant',
        content: '🔍 Agent 1: Analyzuji layout a obrázky...',
        timestamp: Date.now(),
      }]);

      const layoutDescription = await callGeminiWithVision(VISUAL_ANALYST_PROMPT, [
        { role: 'user', content: 'Popiš detailně layout tohoto pracovního listu – všechny sekce, jejich šířky, obrázky a jejich vztahy k textovým blokům.', image: uploadedImage },
      ]);

      setVisualAnalysis(layoutDescription);

      setChatMessages(prev => prev.map(m =>
        m.id === 'msg-agent1-start'
          ? { ...m, content: `✅ Agent 1 dokončen – rozpoznal jsem layout:\n\n${layoutDescription.substring(0, 300)}...` }
          : m
      ));

      // ── AGENT 2: JSON Builder ────────────────────────────────────────
      setAgentStep('building');
      setChatMessages(prev => [...prev, {
        id: `msg-agent2-start`,
        role: 'assistant',
        content: '⚙️ Agent 2: Převádím popis na strukturovaný JSON...',
        timestamp: Date.now(),
      }]);

      const jsonPrompt = `Zde je detailní popis layoutu pracovního listu od vizuálního analytika:\n\n${layoutDescription}\n\nPřeveď tento popis do JSON formátu podle svých pravidel. Vždy uveď gridSpan u každého bloku a použij _blockImage pro obrázky označené jako BLOCKIMAGE.`;

      const jsonResponse = await callGeminiWithVision(JSON_BUILDER_PROMPT, [
        { role: 'user', content: jsonPrompt },
      ]);

      const parsed = parseAgentResponse(jsonResponse);

      if (parsed) {
        let blocks = processRawBlocks(parsed.blocks);
        const hasImages = blocks.some(b =>
          (b.content as any)?._cropBox || (b.content as any)?._blockImage?.cropBox
        );

        setChatMessages(prev => prev.map(m =>
          m.id === 'msg-agent2-start'
            ? { ...m, content: `✅ Agent 2 dokončen – vygenerováno ${blocks.length} bloků.` }
            : m
        ));

        if (hasImages && uploadedImage) {
          setAgentStep('images');
          setChatMessages(prev => [...prev, {
            id: `msg-images`, role: 'assistant',
            content: '🖼️ Agent 3: Extrahování a nahrávání obrázků...',
            timestamp: Date.now(),
          }]);
          blocks = await extractAndUploadImages(blocks, uploadedImage, (msg) => {
            setChatMessages(prev => prev.map(m =>
              m.id === 'msg-images' ? { ...m, content: `🖼️ Agent 3: ${msg}` } : m
            ));
          });
          setChatMessages(prev => prev.map(m =>
            m.id === 'msg-images' ? { ...m, content: '✅ Agent 3: Obrázky nahrány.' } : m
          ));
        }

        setGeneratedBlocks(blocks);
        setGeneratedTitle(parsed.title);
        setAgentStep('done');

        setChatMessages(prev => [...prev, {
          id: `msg-done`, role: 'assistant',
          content: `🎉 Hotovo! Rozpoznal jsem ${blocks.length} bloků. Můžeš je upravit chattem nebo uložit.`,
          timestamp: Date.now(),
        }]);
      } else {
        setError('Agent 2 nevygeneroval validní JSON. Zkus to znovu.');
        setChatMessages(prev => [...prev, {
          id: `msg-err`, role: 'assistant',
          content: `⚠️ Nepodařilo se převést. Surová odpověď:\n\n${jsonResponse.substring(0, 600)}`,
          timestamp: Date.now(),
        }]);
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při komunikaci s AI.');
      setAgentStep('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Build conversation history for API
      const history: { role: string; content: string; image?: string }[] = [];

      // First message with image
      if (uploadedImage) {
        history.push({
          role: 'user',
          content: 'Analyzuj tento pracovní list a převeď ho na bloky.',
          image: uploadedImage,
        });
      }

      // Add the current blocks as context
      if (generatedBlocks.length > 0) {
        const currentJson = JSON.stringify({
          title: generatedTitle,
          blocks: generatedBlocks.map(b => ({ type: b.type, content: b.content })),
        }, null, 2);
        history.push({
          role: 'model' as any,
          content: currentJson,
        });
      }

      // Add new user message
      history.push({
        role: 'user',
        content: userMsg.content,
      });

      const response = await callGeminiWithVision(systemPrompt, history);

      const parsed = parseAgentResponse(response);
      if (parsed) {
        let blocks = processRawBlocks(parsed.blocks);
        const hasImages = blocks.some(b => 
          (b.content as any)?._cropBox || (b.content as any)?._blockImage?.cropBox
        );
        if (hasImages && uploadedImage) {
          blocks = await extractAndUploadImages(blocks, uploadedImage);
        }
        setGeneratedBlocks(blocks);
        setGeneratedTitle(parsed.title);

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-resp`,
          role: 'assistant',
          content: `Hotovo! Aktualizováno na ${blocks.length} bloků${hasImages ? ' (vč. obrázků)' : ''}.`,
          timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        // Response is not JSON - show as text response
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-resp`,
          role: 'assistant',
          content: response.substring(0, 1000),
          timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při komunikaci s AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveAndOpen = () => {
    if (generatedBlocks.length === 0) return;

    const worksheetId = `import-${Date.now()}`;
    const worksheet = {
      id: worksheetId,
      title: generatedTitle || 'Importovaný list',
      description: `Importováno z: ${uploadedImageName || 'screenshot'}`,
      blocks: generatedBlocks,
      metadata: {
        subject: 'other' as const,
        grade: 6 as const,
        estimatedTime: 15,
        keywords: ['import'],
        gridColumns: 12 as const,
        gridGap: 'medium' as const,
        globalFontSize: 'small' as const,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft' as const,
    };

    saveWorksheet(worksheet);
    navigate(`/admin/worksheet-pro/${worksheetId}`);
  };

  const handleCopyJson = () => {
    const json = JSON.stringify({
      title: generatedTitle,
      blocks: generatedBlocks.map(b => ({ type: b.type, content: b.content })),
    }, null, 2);
    navigator.clipboard.writeText(json);
  };

  const handleReset = () => {
    setUploadedImage(null);
    setUploadedImageName('');
    setChatMessages([]);
    setGeneratedBlocks([]);
    setGeneratedTitle('');
    setError(null);
    setChatInput('');
  };

  const handleResetSystemPrompt = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a0e1a',
      color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ===== HEADER ===== */}
      <div style={{
        height: 52,
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        backgroundColor: '#0f172a',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: 13, padding: '6px 8px', borderRadius: 6,
          }}
          onMouseOver={e => (e.currentTarget.style.color = '#94a3b8')}
          onMouseOut={e => (e.currentTarget.style.color = '#64748b')}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Zpět
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles style={{ width: 18, height: 18, color: '#f59e0b' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>Import Agent Studio</span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setShowSystemPrompt(!showSystemPrompt)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: showSystemPrompt ? '#1e293b' : 'none',
            border: '1px solid #334155', color: '#94a3b8',
            cursor: 'pointer', fontSize: 12, padding: '6px 12px', borderRadius: 6,
          }}
        >
          <Settings style={{ width: 14, height: 14 }} />
          System Prompt
        </button>

        {generatedBlocks.length > 0 && (
          <>
            <button
              onClick={handleCopyJson}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px solid #334155', color: '#94a3b8',
                cursor: 'pointer', fontSize: 12, padding: '6px 12px', borderRadius: 6,
              }}
            >
              <Copy style={{ width: 14, height: 14 }} />
              JSON
            </button>

            <button
              onClick={handleSaveAndOpen}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#2563eb', border: 'none', color: '#ffffff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                padding: '6px 16px', borderRadius: 6,
              }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
              Otevřít v editoru
            </button>
          </>
        )}

        <button
          onClick={handleReset}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: 12, padding: '6px 8px', borderRadius: 6,
          }}
        >
          <RotateCcw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* ===== SYSTEM PROMPT EDITOR ===== */}
      {showSystemPrompt && (
        <div style={{
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0f172a',
          padding: 16,
          maxHeight: 400,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>System Prompt</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleResetSystemPrompt}
                style={{
                  background: 'none', border: '1px solid #334155', color: '#94a3b8',
                  cursor: 'pointer', fontSize: 11, padding: '4px 10px', borderRadius: 4,
                }}
              >
                Reset na výchozí
              </button>
              <button
                onClick={() => setShowSystemPrompt(false)}
                style={{
                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4,
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#020617',
              border: '1px solid #1e293b',
              borderRadius: 8,
              color: '#94a3b8',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.5,
              padding: 12,
              resize: 'vertical',
              minHeight: 200,
              outline: 'none',
            }}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
            {systemPrompt.length} znaků • Prompt se automaticky ukládá do localStorage
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ===== LEFT PANEL: Upload + Chat ===== */}
        <div style={{
          width: 420,
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          flexShrink: 0,
        }}>

          {/* Upload Area */}
          <div style={{
            padding: 16,
            borderBottom: '1px solid #1e293b',
            flexShrink: 0,
          }}>
            {!uploadedImage ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #334155',
                  borderRadius: 12,
                  padding: 32,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  backgroundColor: '#020617',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = '#475569')}
                onMouseOut={e => (e.currentTarget.style.borderColor = '#334155')}
              >
                <Upload style={{ width: 32, height: 32, color: '#475569', marginBottom: 12 }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8', marginBottom: 4 }}>
                  Přetáhni screenshot sem
                </span>
                <span style={{ fontSize: 12, color: '#475569' }}>
                  nebo klikni pro výběr (PNG, JPG, WEBP)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon style={{ width: 14, height: 14, color: '#4ade80' }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{uploadedImageName}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setShowUploadedImage(!showUploadedImage)}
                      style={{
                        background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4,
                      }}
                    >
                      {showUploadedImage ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                    </button>
                    <button
                      onClick={() => { setUploadedImage(null); setUploadedImageName(''); }}
                      style={{
                        background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4,
                      }}
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>

                {showUploadedImage && (
                  <img
                    src={uploadedImage}
                    alt="Nahraný list"
                    style={{
                      width: '100%',
                      maxHeight: 200,
                      objectFit: 'contain',
                      borderRadius: 8,
                      backgroundColor: '#020617',
                      marginBottom: 8,
                    }}
                  />
                )}

                {chatMessages.length === 0 && (
                  <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#f59e0b',
                      color: '#0f172a',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isLoading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      opacity: isLoading ? 0.7 : 1,
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        {agentStep === 'analyzing' && 'Agent 1: Analyzuji layout...'}
                        {agentStep === 'building' && 'Agent 2: Stavím JSON...'}
                        {agentStep === 'images' && 'Agent 3: Extrahování obrázků...'}
                        {agentStep === 'idle' && 'Analyzuji...'}
                      </>
                    ) : (
                      <>
                        <Sparkles style={{ width: 16, height: 16 }} />
                        Analyzovat a převést (2-agent pipeline)
                      </>
                    )}
                  </button>
                )}

                {/* Storage connectivity test */}
                {uploadedImage && chatMessages.length === 0 && (
                  <button
                    onClick={async () => {
                      try {
                        // Crop a tiny 10x10 test patch from top-left
                        const testCrop = await cropImageFromScreenshot(uploadedImage, { x: 0, y: 0, w: 0.05, h: 0.05 });
                        const url = await uploadBase64ToStorage(testCrop, 'storage-test', 'imported-images');
                        if (url) {
                          setError(null);
                          setChatMessages([{ id: 'test-ok', role: 'assistant', content: `✅ Storage funguje! Test URL: ${url.substring(0, 60)}...`, timestamp: Date.now() }]);
                        } else {
                          setError('❌ Storage upload vrátil null – zkontroluj bucket "generated-images" a jeho RLS policy.');
                        }
                      } catch (e: any) {
                        setError(`❌ Storage test selhal: ${e.message}`);
                      }
                    }}
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #334155',
                      backgroundColor: 'transparent',
                      color: '#64748b',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <CheckCircle2 style={{ width: 12, height: 12 }} />
                    Otestovat nahrávání obrázků
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Permanent 2-agent pipeline button ── always visible when image loaded */}
          {uploadedImage && (
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid #1e293b',
              flexShrink: 0,
              display: 'flex',
              gap: 8,
            }}>
              <button
                onClick={() => {
                  // Reset chat and re-run full pipeline
                  setChatMessages([]);
                  setGeneratedBlocks([]);
                  setAgentStep('idle');
                  setTimeout(() => handleAnalyze(), 50);
                }}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: isLoading ? '#1e293b' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: isLoading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  opacity: isLoading ? 0.6 : 1,
                  boxShadow: isLoading ? 'none' : '0 2px 12px rgba(99,102,241,0.35)',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    {agentStep === 'analyzing' && 'Agent 1: Popisuji layout...'}
                    {agentStep === 'building'  && 'Agent 2: Generuji JSON...'}
                    {agentStep === 'images'    && 'Agent 3: Obrázky...'}
                    {(agentStep === 'idle' || agentStep === 'done') && 'Spouštím...'}
                  </>
                ) : (
                  <>
                    <Sparkles style={{ width: 14, height: 14 }} />
                    Analyzovat (2-agent pipeline)
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              margin: '0 16px',
              marginTop: 8,
              padding: '8px 12px',
              backgroundColor: '#450a0a',
              border: '1px solid #7f1d1d',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#fca5a5',
              flexShrink: 0,
            }}>
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
              {error}
              <button
                onClick={() => setError(null)}
                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', marginLeft: 'auto', padding: 2 }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          )}

          {/* Chat Messages */}
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {chatMessages.length === 0 && !uploadedImage && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                textAlign: 'center',
                padding: 32,
              }}>
                <Sparkles style={{ width: 40, height: 40, marginBottom: 16, color: '#334155' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                  Import Agent Studio
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Nahraj screenshot pracovního listu a agent ho převede na editovatelné bloky.
                  Potom můžeš výstup doladit chatem.
                </div>
              </div>
            )}

            {chatMessages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.5,
                  ...(msg.role === 'user'
                    ? { backgroundColor: '#1d4ed8', color: '#dbeafe' }
                    : { backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }
                  ),
                }}>
                  {msg.image && (
                    <div style={{ marginBottom: 6, fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ImageIcon style={{ width: 12, height: 12 }} />
                      Screenshot přiložen
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Loader2 style={{ width: 14, height: 14, color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Agent pracuje...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          {chatMessages.length > 0 && (
            <div style={{
              padding: 12,
              borderTop: '1px solid #1e293b',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Napiš úpravu... (např. 'přidej ještě 2 otázky')"
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    backgroundColor: '#020617',
                    color: '#e2e8f0',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isLoading}
                  style={{
                    width: 40, height: 40,
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: chatInput.trim() && !isLoading ? '#2563eb' : '#1e293b',
                    color: chatInput.trim() && !isLoading ? '#ffffff' : '#475569',
                    cursor: chatInput.trim() && !isLoading ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Send style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT PANEL: Preview / JSON ===== */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: '#020617',
        }}>
          {/* Preview header */}
          {generatedBlocks.length > 0 && (
            <div style={{
              height: 44,
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 8,
              backgroundColor: '#0f172a',
              flexShrink: 0,
            }}>
              <button
                onClick={() => setShowJson(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: !showJson ? '#1e293b' : 'transparent',
                  color: !showJson ? '#f1f5f9' : '#64748b',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Eye style={{ width: 14, height: 14 }} />
                Preview ({generatedBlocks.length} bloků)
              </button>
              <button
                onClick={() => setShowJson(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: showJson ? '#1e293b' : 'transparent',
                  color: showJson ? '#f1f5f9' : '#64748b',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Code style={{ width: 14, height: 14 }} />
                JSON
              </button>

              <div style={{ flex: 1 }} />

              {generatedTitle && (
                <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                  {generatedTitle}
                </span>
              )}
            </div>
          )}

          {/* Preview content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {generatedBlocks.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#334155',
              }}>
                <Eye style={{ width: 48, height: 48, marginBottom: 16 }} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>Zde se zobrazí preview</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Nahraj obrázek a klikni na Analyzovat</div>
              </div>
            ) : showJson ? (
              <pre style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: 16,
                color: '#94a3b8',
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: 'monospace',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                {JSON.stringify({
                  title: generatedTitle,
                  blocks: generatedBlocks.map(b => ({
                    type: b.type,
                    content: b.content,
                    ...(b.gridSpan ? { gridSpan: b.gridSpan } : {}),
                  })),
                }, null, 2)}
              </pre>
            ) : (
              <div style={{ maxWidth: 600, margin: '0 auto' }}>
                {/* Title */}
                {generatedTitle && (
                  <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottom: '1px solid #1e293b',
                  }}>
                    {generatedTitle}
                  </div>
                )}

                {/* Blocks */}
                {generatedBlocks.map((block, index) => (
                  <BlockPreview key={block.id} block={block} index={index} />
                ))}

                {/* Summary */}
                <div style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#64748b',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>{generatedBlocks.length} bloků celkem</span>
                  <span>
                    {Array.from(new Set(generatedBlocks.map(b => b.type))).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
