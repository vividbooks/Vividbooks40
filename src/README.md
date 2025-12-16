# Documentation Platform

Vlastní dokumentační web ve stylu Mintlify s plnou administrací, postavený na React, TypeScript a Supabase.

## 🚀 Funkce

### Veřejná část (`/docs`)
- ✅ Zobrazování dokumentace v Markdownu
- ✅ Responzivní levé navigační menu
- ✅ Fulltextové vyhledávání (Cmd/Ctrl + K)
- ✅ Dark/Light režim
- ✅ Mobilní responzivita

### Admin rozhraní (`/admin`)
- ✅ Přihlášení a registrace adminů
- ✅ CRUD operace na stránky
- ✅ Markdown editor s live preview
- ✅ Drag & drop správa menu struktury
- ✅ Automatické generování URL slugů

## 📖 Jak začít

### 1. První spuštění

Aplikace je připravena k použití. Backend běží na Supabase Edge Functions.

### 2. Vytvoření admin účtu

1. Přejděte na `/admin/login`
2. Klikněte na "Need an account? Sign up"
3. Vyplňte email, heslo a jméno
4. Po registraci budete automaticky přihlášeni

### 3. Vytvoření první stránky

1. V admin panelu klikněte na "New Page"
2. Vyplňte:
   - **Title**: Název stránky (např. "Introduction")
   - **Slug**: URL slug (automaticky generován, např. "introduction")
   - **Description**: Krátký popis (volitelné)
   - **Content**: Markdown obsah
3. Klikněte "Save"

### 4. Organizace menu

1. V admin panelu přejděte na "Menu Structure"
2. Použijte tlačítka:
   - **Add Group**: Vytvoří skupinu pro vnořené stránky
   - **Add Page**: Přidá stránku do menu
3. Přetahujte položky pro změnu pořadí
4. Klikněte "Save Menu"

## 🎨 Markdown formátování

Editor podporuje kompletní Markdown syntaxi:

```markdown
# Nadpis 1
## Nadpis 2
### Nadpis 3

**Tučný text**
*Kurzíva*

- Seznam
- Položek

1. Číslovaný
2. Seznam

[Odkaz](https://example.com)

`inline kód`

\`\`\`javascript
// Code block
function hello() {
  console.log("Hello!");
}
\`\`\`

> Citace

| Tabulka | Hlavička |
|---------|----------|
| Buňka   | Data     |
```

## 🔍 Vyhledávání

- Stiskněte **Cmd/Ctrl + K** kdekoli na stránce
- Začněte psát dotaz
- Používejte šipky ↑↓ pro navigaci
- Enter pro přechod na stránku

## 🌓 Dark Mode

Přepínání mezi světlým a tmavým režimem pomocí tlačítka v hlavičce. Preference se ukládá do localStorage.

## 🔐 Zabezpečení

- Admin rozhraní je chráněno Supabase Auth
- Všechny admin operace vyžadují autentizaci
- Veřejné API endpointy jsou pouze pro čtení
- Hesla jsou bezpečně hashována pomocí Supabase

## 📚 Struktura projektu

```
/
├── App.tsx                      # Hlavní komponenta s routingem
├── components/
│   ├── DocumentationLayout.tsx  # Layout pro veřejnou část
│   ├── AdminLayout.tsx          # Admin dashboard
│   ├── PageEditor.tsx           # Editor stránek s Markdown
│   ├── MenuEditor.tsx           # Drag & drop menu editor
│   ├── NavigationMenu.tsx       # Levé navigační menu
│   ├── MarkdownRenderer.tsx     # Renderer pro Markdown
│   └── SearchModal.tsx          # Vyhledávací modal
├── supabase/functions/server/
│   └── index.tsx                # Backend API server
└── utils/
    └── supabase/
        └── info.tsx             # Supabase konfigurace
```

## 🛠️ Technologie

- **Frontend**: React, TypeScript, React Router
- **Styling**: Tailwind CSS
- **Backend**: Supabase Edge Functions (Hono)
- **Databáze**: Supabase KV Store
- **Auth**: Supabase Auth
- **Markdown**: marked
- **Drag & Drop**: dnd-kit

## 📝 API Endpointy

### Veřejné (pouze čtení)
- `GET /pages` - Všechny stránky
- `GET /pages/:slug` - Detail stránky
- `GET /menu` - Menu struktura
- `GET /search?q=query` - Vyhledávání

### Chráněné (vyžadují autentizaci)
- `POST /signup` - Registrace admina
- `POST /pages` - Vytvoření stránky
- `PUT /pages/:slug` - Aktualizace stránky
- `DELETE /pages/:slug` - Smazání stránky
- `PUT /menu` - Aktualizace menu

## 💡 Tips

1. **Automatický slug**: Při psaní názvu stránky se slug generuje automaticky
2. **Live preview**: Zapněte "Show Preview" v editoru pro okamžitou náhled
3. **Keyboard shortcuts**: Cmd/Ctrl + K pro vyhledávání
4. **Vnořené menu**: Vytvořte skupiny pro organizaci stránek do kategorií
5. **Responsive**: Web funguje perfektně na mobilech i desktopu

## 🐛 Troubleshooting

### Nemohu se přihlásit
- Zkontrolujte, zda jste se nejdříve zaregistrovali
- Email musí být validní formát
- Heslo musí mít alespoň 6 znaků

### Stránka se nezobrazuje v menu
- Přejděte do "Menu Structure" v admin panelu
- Přidejte stránku do menu pomocí "Add Page"
- Nezapomeňte kliknout "Save Menu"

### Změny se neukládají
- Zkontrolujte, že jste přihlášeni (pravý horní roh)
- Zkontrolujte konzoli prohlížeče pro chyby
- Session může vypršet - zkuste se znovu přihlásit

## 📄 Licence

Tento projekt je vytvořen pro Figma Make.
