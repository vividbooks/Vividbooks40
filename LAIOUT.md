# Laiout — URL a databáze

## URL v aplikaci

| Cesta | Co zobrazí |
|--------|------------|
| **`/laiout/`** | Knihovna všech knih (dříve také `/admin/pro`) — **doporučeno s koncovým /** |
| **`/laiout`** | Přesměruje na **`/laiout/`** |
| **`/laiout/:id`** | Editor konkrétní knihy (`id` = ID z tabulky `teacher_books`) |

Na GitHub Pages je prefix z Vite (`basename`), např. **`https://vividbooks.github.io/Vividbooks40/laiout/`**.  
Build vytvoří **`laiout/index.html`** (stejný obsah jako hlavní `index.html`), aby server vracel **200** místo holého 404 u cesty se složkou.

Staré cesty **`/admin/pro`** a **`/admin/workbook-pro/:id`** dál fungují; nové kliky v editoru vedou na **`/laiout/`** (bez koncového lomítka tě přesměruje router na kanonickou URL).

---

## Co udělat v databázi (Supabase)

### 1) Knihy a RLS (základ — pokud ještě nemáš)

Spusť migrace v pořadí, které v projektu patří k `teacher_books` / `teacher_worksheets`, minimálně:

- `20260309_teacher_books.sql`
- `20260309_teacher_books_pages.sql` (pokud používáš `total_pages`)
- `20260323120000_teacher_books_rls_insert.sql`

### 2) Sdílení knih + správné RLS na listech

Spusť migraci:

**`supabase/migrations/20260324130000_teacher_book_shares.sql`**

Ta:

- vytvoří tabulku **`teacher_book_shares`** (kdo s kým sdílí kterou knihu),
- přidá politiky **SELECT** na **`teacher_books`** pro nasdílené knihy,
- přidá **SELECT** na **`teacher_worksheets`** pro listy v nasdílené knize (čtení),
- zruší případnou příliš volnou politiku **`allow_all_teacher_worksheets`** a nastaví znovu **jen vlastní** řádky + výjimku pro sdílené knihy,
- vytvoří funkci **`lookup_user_id_for_book_share(target_email text)`** (pro sdílení podle e-mailu v UI).

**Jak spustit**

- **Supabase CLI:** `supabase db push` / `supabase migration up` (podle tvého workflow), nebo  
- **Dashboard → SQL:** vložit obsah souboru a spustit.

### 3) Google OAuth (přihlášení)

V **Supabase → Authentication → URL configuration**:

- **Redirect URLs** musí obsahovat  
  `https://<tvůj-web>/auth/callback`  
  a u lokálu např. `http://localhost:5173/auth/callback` (port podle Vite).

V **Google Cloud Console** (OAuth klient) stejné autorizované přesměrování.

---

Po nasazení migrace ověř v **Table Editor**, že existuje tabulka `teacher_book_shares`, a v **Database → Functions** funkce `lookup_user_id_for_book_share`.
