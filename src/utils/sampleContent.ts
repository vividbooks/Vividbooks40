export const samplePages = [
  // Knihovna Vividbooks kategorie
  {
    slug: 'introduction',
    title: 'Úvod do Knihovny VividBooks',
    description: 'Vítejte v dokumentaci Knihovny VividBooks',
    category: 'knihovna-vividbooks',
    content: `Naučte se používat Knihovnu VividBooks k vytváření, správě a sdílení digitálních knih.

:::warning Důležité upozornění
Tato dokumentace je určena pro verzi 2.0 a novější. Starší verze mohou mít odlišné funkce.
:::

## Co je Knihovna VividBooks?

Knihovna VividBooks je **výkonná platforma** pro vytváření, správu a sdílení *interaktivních digitálních knih*. Ať už píšete román, vytváříte vzdělávací obsah nebo budujete znalostní bázi, VividBooks poskytuje vše, co potřebujete.

:::info Funkce platformy
VividBooks kombinuje sílu moderních editorů s pokročilými nástroji pro spolupráci a publikování.
:::

## Klíčové funkce

| Funkce | Popis | Dostupnost |
|--------|-------|------------|
| Editor rich textu | Intuitivní WYSIWYG editor | Všechny plány |
| Interaktivní prvky | Videa, obrázky, animace | Pro a vyšší |
| Spolupráce v reálném čase | Multi-user editing | Pro a vyšší |
| Publikování | Export do PDF, EPUB, Web | Všechny plány |
| Analytika | Detailní statistiky čtenářů | Enterprise |

## Podporované formáty

VividBooks podporuje širokou škálu mediálních formátů:

- **Obrázky**: JPG, PNG, GIF, WebP, SVG
- **Video**: MP4, WebM, Ogg
- **Audio**: MP3, WAV, OGG
- **Dokumenty**: PDF, DOCX (import)

:::tip Doporučení
Pro nejlepší výkon doporučujeme používat WebP pro obrázky a WebM pro videa.
:::

## Začínáme

Jste připraveni vytvořit svou první knihu? Začněte prozkoumáním témat v postranním menu, abyste se dozvěděli více o VividBooks.

### Rychlý start

\`\`\`javascript
// Příklad: Vytvoření knihy pomocí API
const book = await vividbooks.create({
  title: "Moje první kniha",
  author: "Jan Novák",
  language: "cs"
});
\`\`\`

## Další zdroje

Pro více informací navštivte:

- [Oficiální web](https://vividbooks.com)
- [YouTube tutoriály](https://youtube.com/vividbooks)
- [Komunitní fórum](https://community.vividbooks.com)`,
    order: 0
  },
  {
    slug: 'getting-started',
    title: 'Začínáme',
    description: 'Vytvořte svou první knihu s VividBooks',
    category: 'knihovna-vividbooks',
    content: `Začněte s VividBooks a vytvořte svou první digitální knihu během několika minut.

## Vytvoření první knihy

Vytvoření knihy ve VividBooks je jednoduché:

1. **Přihlaste se** do svého účtu VividBooks
2. **Klikněte na "Nová kniha"** z vaší nástěnky
3. **Vyberte šablonu** nebo začněte od začátku
4. **Začněte psát** váš obsah

## Nastavení knihy

Při vytváření nové knihy můžete konfigurovat:

- **Název** - Jméno vaší knihy
- **Popis** - Stručné shrnutí
- **Obrázek obálky** - Poutavá obálka
- **Soukromí** - Veřejné nebo soukromé
- **Kategorie** - Organizujte své knihy

## Další kroky

Po vytvoření knihy můžete:

- Přidat kapitoly a sekce
- Formátovat text
- Vložit obrázky a média
- Pozvat spolupracovníky
- Zobrazit náhled knihy`,
    order: 1
  },
  {
    slug: 'collaboration',
    title: 'Funkce spolupráce',
    description: 'Spolupracujte s dalšími autory',
    category: 'knihovna-vividbooks',
    content: `Spolupracujte s dalšími autory v reálném čase.

## Pozvání spolupracovníků

Přidejte spoluautory do své knihy:

1. Otevřete **Nastavení knihy**
2. Přejděte na záložku **Spolupracovníci**
3. Zadejte e-mailové adresy
4. Nastavte úrovně oprávnění

## Úrovně oprávnění

Kontrolujte, co mohou spolupracovníci dělat:

- **Vlastník** - Plná kontrola
- **Editor** - Může upravovat obsah
- **Komentátor** - Může zanechávat komentáře
- **Čtenář** - Přístup pouze pro čtení

## Spolupráce v reálném čase

Pracujte společně hladce:

- Vidíte, kdo je online
- Živé pozice kurzorů
- Okamžité aktualizace
- Řešení konfliktů`,
    order: 2
  },

  // Vividboard kategorie
  {
    slug: 'introduction',
    title: 'Úvod do Vividboard',
    description: 'Začínáme s Vividboard',
    category: 'vividboard',
    content: `Vítejte v dokumentaci Vividboard - interaktivní tabule pro vzdělávání.

## Co je Vividboard?

Vividboard je moderní interaktivní tabule navržená speciálně pro vzdělávací účely. Kombinuje sílu digitálních nástrojů s intuitivním rozhraním pro učitele a studenty.

## Hlavní funkce

- **Kreslení a poznámky** - Intuitivní nástroje pro psaní a kreslení
- **Multimediální obsah** - Vkládejte obrázky, videa a dokumenty
- **Spolupráce** - Více uživatelů může pracovat současně
- **Šablony** - Předpřipravené šablony pro různé předměty
- **Export a sdílení** - Jednoduché sdílení a export obsahu

## Použití

Vividboard je ideální pro:

- Interaktivní výuku ve třídě
- Online vzdělávání
- Prezentace a workshopy
- Brainstorming a týmovou práci
- Vzdělávací projekty`,
    order: 0
  },
  {
    slug: 'tools-overview',
    title: 'Přehled nástrojů',
    description: 'Nástroje dostupné ve Vividboard',
    category: 'vividboard',
    content: `Seznamte se s nástroji dostupnými ve Vividboard.

## Kreslicí nástroje

### Pero
- Různé barvy a tloušťky
- Podpora tlaku (na podporovaných zařízeních)
- Vyhlazování čar

### Zvýrazňovač
- Průhledné zvýraznění
- Více barev
- Nastavitelná šířka

### Guma
- Částečné mazání
- Úplné mazání objektu
- Nastavitelná velikost

## Tvarové nástroje

- **Čára** - Rovné čáry s přichycením
- **Obdélník** - Vyplněné nebo ohraničené
- **Kruh** - Dokonalé kruhy a elipsy
- **Šipka** - Pro diagramy a směrové značky

## Textové nástroje

- **Textové pole** - Psaný text
- **Formátování** - Různé fonty, velikosti a barvy
- **Matematické symboly** - Vestavěná podpora LaTeX`,
    order: 1
  },
  {
    slug: 'collaboration',
    title: 'Spolupráce na Vividboard',
    description: 'Jak spolupracovat s ostatními',
    category: 'vividboard',
    content: `Naučte se, jak efektivně spolupracovat na Vividboard.

## Sdílení tabule

Pozvěte ostatní na svou tabuli:

1. Klikněte na tlačítko **Sdílet**
2. Vygenerujte odkaz pro sdílení
3. Nastavte oprávnění (prohlížení/úpravy)
4. Sdílejte odkaz s účastníky

## Práce v reálném čase

Při společné práci můžete:

- Vidět kurzory ostatních účastníků
- Sledovat změny v reálném čase
- Používat různé barvy pro každého uživatele
- Chat pro komunikaci

## Řízení přístupu

Kontrolujte, kdo může co dělat:

- **Prezentátor** - Plné oprávnění k úpravám
- **Přispěvatel** - Může přidávat obsah
- **Pozorovatel** - Pouze zobrazení

## Ukládání a historie

- Automatické ukládání každých 30 sekund
- Historie verzí
- Možnost obnovení předchozích stavů`,
    order: 2
  },

  // Metodika kategorie
  {
    slug: 'introduction',
    title: 'Úvod do Metodiky',
    description: 'Metodické materiály pro učitele',
    category: 'metodika',
    content: `Vítejte v metodické sekci VividBooks.

## O metodice

Tato sekce obsahuje metodické materiály, návody a osvědčené postupy pro použití platformy VividBooks ve vzdělávání.

## Pro koho je metodika určena

- **Učitele** - Pedagogy všech stupňů vzdělávání
- **Lektory** - Školce a vzdělávací odborníky
- **Koordinátory** - Metodiky a vedoucí pedagogické pracovníky
- **Školitele** - Osoby provádějící školení

## Co najdete v metodice

- Didaktické postupy
- Příklady z praxe
- Návody krok za krokem
- Šablony a materiály
- Tipy a triky

## Jak používat metodiku

Materiály jsou uspořádány od základních konceptů k pokročilým technikám. Doporučujeme začít úvodem a postupovat podle struktury v menu.`,
    order: 0
  },
  {
    slug: 'lesson-planning',
    title: 'Plánování výuky',
    description: 'Jak efektivně plánovat výuku s VividBooks',
    category: 'metodika',
    content: `Naučte se efektivně plánovat výuku s využitím VividBooks.

## Příprava hodiny

### Krok 1: Definice cílů

- Stanovte jasné vzdělávací cíle
- Určete klíčové kompetence
- Definujte očekávané výstupy

### Krok 2: Výběr obsahu

- Vyberte vhodný materiál z knihovny
- Přizpůsobte obsah úrovni studentů
- Připravte doplňkové materiály

### Krok 3: Struktura hodiny

- Úvod a motivace (5-10 min)
- Hlavní část s aktivitami (30-40 min)
- Shrnutí a reflexe (5-10 min)

## Využití interaktivních prvků

### Kvízy a testy

- Pro ověření pochopení
- Formativní hodnocení
- Okamžitá zpětná vazba

### Multimediální obsah

- Videa pro vizualizaci
- Obrázky a diagramy
- Audio nahrávky

## Diferencovaná výuka

Přizpůsobte obsah různým úrovním:

- Základní úroveň - Jednodušší úkoly
- Pokročilá úroveň - Rozšiřující aktivity
- Nadstandardní úroveň - Výzvové projekty`,
    order: 1
  },
  {
    slug: 'assessment',
    title: 'Hodnocení a zpětná vazba',
    description: 'Metody hodnocení s VividBooks',
    category: 'metodika',
    content: `Efektivní hodnocení studentů pomocí VividBooks.

## Typy hodnocení

### Formativní hodnocení

Průběžné ověřování pochopení:

- Krátké kvízy během hodiny
- Diskusní otázky
- Peer-to-peer hodnocení
- Sebereflexe

### Sumativní hodnocení

Závěrečné ověření znalostí:

- Komplexní testy
- Projekty
- Prezentace
- Portfolio

## Poskytování zpětné vazby

### Konstruktivní zpětná vazba

- Specifická a konkrétní
- Zaměřená na chování, ne osobu
- Včasná a pravidelná
- Pozitivní i konstruktivní

### Nástroje pro zpětnou vazbu

- Komentáře v dokumentech
- Audio zpětná vazba
- Video zprávy
- Strukturované formuláře

## Sledování pokroku

- Využití analytických nástrojů
- Portfolia studentských prací
- Individuální rozvojové plány
- Reporty pro rodiče`,
    order: 2
  },
  {
    slug: 'best-practices',
    title: 'Osvědčené postupy',
    description: 'Tipy a triky od zkušených pedagogů',
    category: 'metodika',
    content: `Osvědčené postupy od zkušených uživatelů VividBooks.

## Organizace obsahu

### Struktura kurzu

- Logické uspořádání kapitol
- Jasná hierarchie témat
- Konzistentní formátování
- Snadná navigace

### Pojmenování

- Popisné názvy kapitol
- Srozumitelné popisy
- Konzistentní terminologie

## Engagement studentů

### Interaktivita

- Pravidelné otázky k diskusi
- Praktické úkoly
- Skupinové projekty
- Herní prvky (gamifikace)

### Variabilita

- Střídání typů aktivit
- Různé formáty obsahu
- Individuální i skupinová práce
- Online i offline aktivity

## Technické tipy

- Pravidelné zálohy obsahu
- Testování na různých zařízeních
- Přístupnost pro všechny studenty
- Optimalizace multimédií

## Časový management

- Realistické plánování času
- Buffer pro diskusi
- Flexibility v rozvrhu
- Alternativní aktivity`,
    order: 3
  }
];

export const sampleMenu = {
  'knihovna-vividbooks': [
    {
      id: 'intro-section',
      title: 'Úvod',
      slug: 'introduction',
      children: []
    },
    {
      id: 'getting-started-section',
      title: 'Začínáme',
      children: [
        {
          id: 'getting-started',
          title: 'První kroky',
          slug: 'getting-started',
          children: []
        }
      ]
    },
    {
      id: 'features-section',
      title: 'Funkce',
      children: [
        {
          id: 'collaboration',
          title: 'Spolupráce',
          slug: 'collaboration',
          children: []
        }
      ]
    }
  ],
  'vividboard': [
    {
      id: 'intro-section',
      title: 'Úvod',
      slug: 'introduction',
      children: []
    },
    {
      id: 'tools-section',
      title: 'Nástroje',
      children: [
        {
          id: 'tools-overview',
          title: 'Přehled nástrojů',
          slug: 'tools-overview',
          children: []
        }
      ]
    },
    {
      id: 'collaboration-section',
      title: 'Spolupráce',
      slug: 'collaboration',
      children: []
    }
  ],
  'metodika': [
    {
      id: 'intro-section',
      title: 'Úvod',
      slug: 'introduction',
      children: []
    },
    {
      id: 'teaching-section',
      title: 'Výuka',
      children: [
        {
          id: 'lesson-planning',
          title: 'Plánování výuky',
          slug: 'lesson-planning',
          children: []
        },
        {
          id: 'assessment',
          title: 'Hodnocení',
          slug: 'assessment',
          children: []
        }
      ]
    },
    {
      id: 'best-practices-section',
      title: 'Osvědčené postupy',
      slug: 'best-practices',
      children: []
    }
  ]
};
