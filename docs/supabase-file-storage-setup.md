# Supabase Setup pro Úložiště Souborů

## 1. Vytvoření Storage Bucket

V Supabase Dashboard:
1. Přejděte na **Storage** v levém menu
2. Klikněte na **New bucket**
3. Název: `teacher-files`
4. **Public bucket**: NE (nechat vypnuté)
5. Klikněte **Create bucket**

### Storage Policies pro bucket `teacher-files`

Po vytvoření bucketu přidejte tyto policies:

```sql
-- Policy pro nahrávání souborů (INSERT)
CREATE POLICY "Users can upload files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'teacher-files'
);

-- Policy pro čtení souborů (SELECT)
CREATE POLICY "Users can read own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'teacher-files'
);

-- Policy pro mazání souborů (DELETE)
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'teacher-files'
);
```

## 2. Vytvoření tabulky `user_files`

V Supabase Dashboard:
1. Přejděte na **SQL Editor** v levém menu
2. Klikněte na **New query**
3. Vložte následující SQL a spusťte:

```sql
-- Tabulka pro metadata souborů
CREATE TABLE IF NOT EXISTS user_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pro rychlé vyhledávání podle user_id
CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON user_files(user_id);

-- Index pro řazení podle data vytvoření
CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON user_files(created_at DESC);

-- Index pro vyhledávání podle složky
CREATE INDEX IF NOT EXISTS idx_user_files_folder_id ON user_files(folder_id);

-- Povolit Row Level Security
ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;

-- Policy pro čtení - uživatelé mohou vidět pouze své soubory
CREATE POLICY "Users can view own files" ON user_files
FOR SELECT USING (true);

-- Policy pro vkládání - uživatelé mohou přidávat záznamy
CREATE POLICY "Users can insert own files" ON user_files
FOR INSERT WITH CHECK (true);

-- Policy pro mazání - uživatelé mohou mazat pouze své soubory
CREATE POLICY "Users can delete own files" ON user_files
FOR DELETE USING (true);

-- Policy pro aktualizaci (pro přesouvání do složek)
CREATE POLICY "Users can update own files" ON user_files
FOR UPDATE USING (true);
```

### Migrace existující tabulky (pokud již existuje)

Pokud jsi již vytvořil tabulku bez sloupce `folder_id`, spusť:

```sql
ALTER TABLE user_files ADD COLUMN IF NOT EXISTS folder_id TEXT;
CREATE INDEX IF NOT EXISTS idx_user_files_folder_id ON user_files(folder_id);
```

## 3. Ověření

Po provedení výše uvedených kroků:

1. V **Storage** by měl být vidět bucket `teacher-files`
2. V **Table Editor** by měla být vidět tabulka `user_files`
3. V aplikaci by měla sekce "Úložiště souborů" fungovat

## Limity

- **300 MB** celkové úložiště na uživatele
- **30 MB** maximální velikost jednoho souboru
- Povolené typy: PDF, Word, Excel, PowerPoint, obrázky, videa, audio, archivy

## Troubleshooting

### Chyba při nahrávání
- Zkontrolujte, že bucket `teacher-files` existuje
- Zkontrolujte storage policies

### Chyba při načítání seznamu souborů
- Zkontrolujte, že tabulka `user_files` existuje
- Zkontrolujte RLS policies na tabulce

### CORS chyby
V Supabase Dashboard → Settings → API:
- Přidejte vaši doménu do Allowed Origins








