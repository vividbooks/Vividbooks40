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

### 2b) Oprava rekurze RLS („infinite recursion … teacher_books“ / HTTP 500)

Po migraci sdílení může PostgreSQL hlásit chybu při vytváření / načítání knih. Spusť **v tomto pořadí**:

1. **`20260324140000_fix_teacher_books_rls_recursion.sql`** — politiky `teacher_book_shares` používají **`teacher_book_is_owner`** (`SECURITY DEFINER`).

2. **`20260324150000_teacher_books_shared_select_definer.sql`** — politika **`teacher_books_select_shared`** a čtení listů ve sdílené knize používají **`user_has_teacher_book_share`**, aby se při SELECT na `teacher_books` vůbec nešlo přes RLS do `teacher_book_shares` (jinak může zůstat 500 i po kroku 1).

### 2c) Přehled knihy — správný počet stran / náhledy

Pro **rychlé načtení** se z DB tahají jen řádky `teacher_worksheets` bez celého `content`. Počet stran se doplňuje RPC **`worksheet_page_counts`** z uloženého JSON (`metadata.pageCount` nebo `blocks[].pageIndex`).

Spusť migraci:

**`supabase/migrations/20260325120000_worksheet_page_counts_rpc.sql`**

Bez ní klient v konzoli vypíše varování a přehled může zůstat u kapitol se **1 stránkou**, dokud list neotevřeš.

### 3) Google OAuth (přihlášení)

V **Supabase → Authentication → URL configuration**:

- **Site URL** pro produkci nastav na kanonickou adresu webu (ne localhost), např.  
  `https://vividbooks.github.io/Vividbooks40`  
  — jinak po OAuth může Supabase přesměrovat na starý localhost z **Site URL**.
- **Redirect URLs** (všechny, které používáš) musí obsahovat např.  
  `https://vividbooks.github.io/Vividbooks40/auth/callback`  
  a lokálně `http://localhost:3000/auth/callback` (port podle `vite` / `npm run dev`).

V **Google Cloud Console** u OAuth klienta zůstává redirect na **Supabase** (`https://<ref>.supabase.co/auth/v1/callback`), ne na Vividbooks URL — ty řeší až Supabase podle `redirectTo` z aplikace.

---

Po nasazení migrací ověř v **Database → Functions** také **`user_has_teacher_book_share`**.
