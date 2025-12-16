# Shared Documents - Supabase Setup

Pro fungování sdílení dokumentů je potřeba vytvořit tabulku v Supabase.

## SQL pro vytvoření tabulky

Spusť tento SQL v Supabase SQL Editor (https://supabase.com/dashboard):

```sql
-- Create shared_documents table
CREATE TABLE IF NOT EXISTS shared_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Bez názvu',
  content TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  document_type TEXT DEFAULT 'lesson',
  featured_media TEXT,
  section_images JSONB,
  slug TEXT,
  show_toc BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE shared_documents ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (anyone can view shared documents)
CREATE POLICY "Anyone can view shared documents" 
  ON shared_documents 
  FOR SELECT 
  USING (true);

-- Create policy for public insert/update (anyone can share documents)
-- Note: In production, you might want to restrict this to authenticated users
CREATE POLICY "Anyone can insert shared documents" 
  ON shared_documents 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update shared documents" 
  ON shared_documents 
  FOR UPDATE 
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shared_documents_id ON shared_documents(id);
CREATE INDEX IF NOT EXISTS idx_shared_documents_updated_at ON shared_documents(updated_at);
```

## Po spuštění SQL

Po vytvoření tabulky by sdílení dokumentů mělo fungovat:

1. Otevři dokument v "Můj obsah"
2. Klikni na "Sdílet dokument"
3. Klikni na "Kopírovat odkaz" - dokument se automaticky uloží do Supabase
4. Odkaz můžeš poslat komukoliv a dokument se jim načte


