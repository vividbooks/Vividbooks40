# Admin Guide - Documentation Platform

Tento průvodce vás provede správou dokumentační platformy.

## 🔐 Přihlášení do administrace

1. Otevřete `/admin/login`
2. První spuštění:
   - Klikněte na "Need an account? Sign up"
   - Vyplňte email, heslo (min. 6 znaků) a jméno
   - Po registraci budete automaticky přihlášeni
3. Další přihlášení:
   - Použijte svůj email a heslo
   - Session zůstane aktivní i po zavření prohlížeče

## 📝 Správa stránek

### Vytvoření nové stránky

1. V admin panelu klikněte na **"New Page"**
2. Vyplňte formulář:
   - **Title**: Název stránky (zobrazuje se v menu a jako nadpis)
   - **Slug**: URL slug (automaticky se generuje z názvu, ale můžete upravit)
   - **Description**: Krátký popis (zobrazuje se pod nadpisem, nepovinné)
   - **Content**: Markdown obsah stránky
3. Použijte **"Show Preview"** pro náhled před uložením
4. Klikněte **"Save"**

### Editace existující stránky

1. V seznamu stránek klikněte na **"Edit"** u příslušné stránky
2. Upravte jakékoliv pole
3. Změna slugu vytvoří novou URL (stará přestane fungovat)
4. Klikněte **"Save"**

### Smazání stránky

1. V seznamu stránek klikněte na **"Delete"** u příslušné stránky
2. Potvrďte smazání
3. ⚠️ Pokud je stránka v menu, odstraní se i odtud

### Zobrazení stránky

- Klikněte na **"View"** pro otevření stránky v novém tabu
- Nebo přejděte na `/docs/{slug}`

## 📋 Správa menu

Menu struktura určuje, jak se stránky zobrazují v levém navigačním panelu.

### Přidání stránky do menu

1. Přejděte na **"Menu Structure"** v admin panelu
2. Klikněte **"Add Page"**
3. Vyberte stránku z rozbalovacího seznamu
4. Klikněte **"Save Menu"**

### Vytvoření skupiny

Skupiny slouží k organizaci stránek do kategorií:

1. Klikněte **"Add Group"**
2. Pojmenujte skupinu (např. "Getting Started", "API Reference")
3. Klikněte na **+** vedle skupiny pro přidání stránky do ní
4. Klikněte **"Save Menu"**

### Změna pořadí

1. Uchopit položku za ikonu ⋮⋮ (grip)
2. Přetáhnout na nové místo
3. Klikněte **"Save Menu"**

### Odstranění z menu

1. Klikněte na ikonu 🗑️ vedle položky
2. Stránka se odstraní z menu (stránka samotná zůstane v databázi)
3. Klikněte **"Save Menu"**

### Vnořené menu

Skupiny mohou obsahovat další stránky:

```
📁 Getting Started
  📄 Introduction
  📄 Installation
  📄 Quick Start
📁 API Reference
  📄 Authentication
  📄 Endpoints
📄 FAQ
```

## ✍️ Psaní v Markdownu

### Základní syntaxe

```markdown
# Nadpis 1 (h1)
## Nadpis 2 (h2)
### Nadpis 3 (h3)

**Tučný text**
*Kurzíva*
~~Přeškrtnutý text~~

[Odkaz na externí stránku](https://example.com)
[Odkaz na jinou dokumentační stránku](/docs/jina-stranka)
```

### Seznamy

```markdown
Nečíslovaný seznam:
- První položka
- Druhá položka
  - Vnořená položka
  - Další vnořená

Číslovaný seznam:
1. První krok
2. Druhý krok
3. Třetí krok
```

### Kód

Inline kód: \`const x = 5;\`

Code block:
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`

Podporované jazyky: javascript, typescript, python, java, css, html, bash, json, atd.

### Citace

```markdown
> Toto je citace.
> Může pokračovat na více řádků.
```

### Tabulky

```markdown
| Hlavička 1 | Hlavička 2 | Hlavička 3 |
|------------|------------|------------|
| Buňka 1    | Buňka 2    | Buňka 3    |
| Buňka 4    | Buňka 5    | Buňka 6    |
```

### Obrázky

```markdown
![Alt text](URL_obrazku)
```

⚠️ Poznámka: Obrázky musí být hostovány externě (např. Imgur, Cloudinary)

### Horizontální čára

```markdown
---
```

## 🎨 Styling

Všechny Markdown prvky jsou automaticky stylované podle dark/light módu. Nemusíte přidávat CSS.

### Barevné bloky

Pro důležité upozornění použijte citaci:

```markdown
> ⚠️ **Upozornění**: Toto je důležité!

> 💡 **Tip**: Užitečná rada pro uživatele

> ❌ **Chyba**: Co se může pokazit
```

## 🔍 SEO a metadata

### Title
- Používá se jako:
  - Titulek v prohlížeči
  - Název v menu
  - Hlavní nadpis stránky

### Description
- Krátký popis (150-200 znaků)
- Zobrazuje se pod nadpisem stránky
- Vyhledávání prochází i toto pole

### Slug
- Musí být jedinečný
- Používá se v URL: `/docs/{slug}`
- Best practices:
  - Použijte malá písmena
  - Slova oddělujte pomlčkami
  - Bez diakritiky
  - Příklady: `getting-started`, `api-authentication`, `faq`

## 🔎 Vyhledávání

Vyhledávání automaticky indexuje:
- Název stránky
- Popis
- Celý obsah

Uživatelé mohou vyhledávat pomocí:
- Cmd/Ctrl + K (klávesová zkratka)
- Kliknutí na "Search" v hlavičce

## 🌓 Dark/Light Mode

Režim je uložen v localStorage, takže preference uživatele přetrvává mezi návštěvami.

V admin panelu můžete přepínat režim pro preview, jak budou stránky vypadat.

## 🚀 Workflow doporučení

### Pro nový projekt:

1. **Plánování struktury**
   - Napište si seznam stránek které potřebujete
   - Rozdělte je do logických kategorií

2. **Vytvoření stránek**
   - Začněte se "Introduction" nebo "Getting Started"
   - Pokračujte hlavními tématy
   - Přidejte detailní stránky

3. **Organizace menu**
   - Vytvořte skupiny pro kategorie
   - Seřaďte stránky logicky (od základů k pokročilým)
   - Nejdůležitější stránky dejte na začátek

4. **Obsah**
   - Začněte s kostrou (nadpisy)
   - Postupně doplňujte obsah
   - Používejte příklady kódu
   - Přidejte obrázky kde je to vhodné

5. **Review & testing**
   - Otestujte vyhledávání
   - Zkontrolujte odkazy mezi stránkami
   - Otestujte na mobilu
   - Zkuste dark mode

## 💡 Best Practices

### Psaní dokumentace

1. **Jasnost**
   - Používejte jednoduché věty
   - Vysvětlujte odborné termíny
   - Přidávejte příklady

2. **Struktura**
   - Začněte s úvodem
   - Rozdělte dlouhé stránky do sekcí
   - Používejte číslované kroky pro návody

3. **Konzistence**
   - Jednotný styl napříč stránkami
   - Jednotné názvy a terminologie
   - Stejná úroveň detailu

4. **Udržitelnost**
   - Aktualizujte obsah pravidelně
   - Označte deprecated sekce
   - Přidejte datum poslední aktualizace do obsahu

### Organizace menu

1. **Logické skupiny**
   - "Getting Started" - úvodní informace
   - "Guides" - detailní návody
   - "API Reference" - technická dokumentace
   - "FAQ" - časté otázky

2. **Pořadí důležitosti**
   - Nejdůležitější nahoře
   - Od základů k pokročilým
   - FAQ a troubleshooting na konec

3. **Limit hloubky**
   - Maximálně 2 úrovně vnoření
   - Více úrovní zhoršuje orientaci

## 🐛 Řešení problémů

### Změny se neukládají

- **Kontrola přihlášení**: Session může vypršet - odhlaste se a přihlaste znovu
- **Chyby v konzoli**: Otevřete DevTools (F12) a zkontrolujte Console
- **Síťové problémy**: Zkontrolujte Network tab v DevTools

### Stránka se nezobrazuje

- **Zkontrolujte slug**: Musí být jedinečný a bez chyb
- **Zkontrolujte menu**: Stránka musí být přidána do menu
- **Cache**: Zkuste tvrdý refresh (Ctrl+Shift+R)

### Markdown se neformátuje správně

- **Syntaxe**: Zkontrolujte Markdown syntaxi
- **Preview**: Použijte live preview v editoru
- **Mezery**: Markdown vyžaduje prázdné řádky mezi prvky

### Menu se neukládá

- **Duplikace**: Nelze přidat stejnou stránku vícekrát
- **Prázdné skupiny**: Lze uložit i prázdnou skupinu
- **Klikněte Save**: Změny se neukládají automaticky

## 📞 Podpora

Pro technické problémy:
1. Zkontrolujte konzoli prohlížeče (F12)
2. Zkontrolujte Network tab pro chyby API
3. Zkuste se odhlásit a přihlásit
4. Vymažte localStorage a zkuste znovu

## 🎓 Tipy pro pokročilé

### Křížové odkazy

Odkazujte mezi stránkami pro lepší navigaci:

```markdown
Pro více informací viz [Authentication](/docs/authentication).
```

### Příklady kódu s kontextem

```markdown
Vytvořte nový soubor `config.js`:

\`\`\`javascript
module.exports = {
  apiKey: 'your-api-key',
  baseURL: 'https://api.example.com'
};
\`\`\`

Poté ho naimportujte:

\`\`\`javascript
const config = require('./config');
console.log(config.apiKey);
\`\`\`
```

### Interní poznámky

Použijte HTML komentáře pro poznámky které se nezobrazí:

```markdown
<!-- TODO: Přidat screenshot -->
<!-- Tato sekce potřebuje update -->
```

Komentáře se nezobrazí na veřejné stránce, ale zůstávají v editoru.

---

**Happy documenting! 📚**
