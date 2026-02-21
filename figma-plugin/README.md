# Vividbooks Sync — Figma Plugin

Importuje worksheety z Vividbooks do Figmy jako strukturované sekce.
Každý worksheet = jedna Section, každý blok = Frame uvnitř.

## Instalace (developer mode)

```bash
cd figma-plugin
npm install
npm run build
```

Poté ve Figmě:
1. Menu → **Plugins** → **Development** → **Import plugin from manifest…**
2. Vyber soubor `figma-plugin/manifest.json`
3. Spusť plugin přes Menu → Plugins → Development → **Vividbooks Sync**

## Vývoj (watch mode)

```bash
npm run watch
```

Po každé změně v `src/` se automaticky přebuildi. Ve Figmě pak plugin **restartuj** (Plugins → Development → Vividbooks Sync).

## Struktura souborů

```
figma-plugin/
├── manifest.json       # Figma plugin metadata
├── src/
│   ├── code.ts         # Plugin sandbox (Figma API, bez internetu)
│   ├── ui.ts           # UI iframe logika (přihlášení, výběr worksheetů)
│   └── ui.html         # UI HTML šablona
├── dist/               # Zkompilované soubory (generované)
│   ├── code.js
│   └── ui.html
└── build.mjs           # esbuild build skript
```

## Mapování bloků

| Vividbooks blok  | Figma element                          |
|------------------|----------------------------------------|
| `heading`        | Text frame, tučný font                 |
| `paragraph`      | Text frame + volitelný obrázek         |
| `image`/galerie  | Grid rectangle frames s ImagePaint     |
| `free-answer`    | Otázka + pod-otázkové karty/linky      |
| `multiple-choice`| Otázka + seznam možností s kroužky     |
| `table`          | Grid buněk                             |
| `spacer`         | Prázdný frame                          |
| `infobox`        | Obarvený rám s textem                  |

## Auth

Plugin se přihlašuje přímo Supabase auth (email + heslo).
Access token je uložen pouze v paměti pluginu — po zavření se zahodí.
