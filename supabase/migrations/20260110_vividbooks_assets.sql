-- ============================================
-- VIVIDBOOKS ASSETS SYSTEM
-- Migrace pro systém médií Vividbooks
-- ============================================

-- 1. Tabulka pro Vividbooks assets (animace, obrázky, nálepky, symboly)
CREATE TABLE IF NOT EXISTS vividbooks_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Základní informace
  name TEXT NOT NULL,
  description TEXT,
  
  -- Typ assetu
  asset_type TEXT NOT NULL CHECK (asset_type IN ('animation', 'image', 'sticker', 'symbol')),
  
  -- URL k souboru (může být relativní cesta nebo absolutní URL)
  file_url TEXT NOT NULL,
  thumbnail_url TEXT, -- Náhledový obrázek (pro animace)
  
  -- Technické detaily
  mime_type TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER, -- Pro animace - délka v milisekundách
  
  -- Kategorizace
  category TEXT, -- Např. "matematika", "fyzika", "biologie"
  subcategory TEXT,
  
  -- Tagy pro vyhledávání (JSONB array)
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- AI-generovaný popis (pro vyhledávání)
  ai_description TEXT,
  
  -- Licence
  license_required BOOLEAN DEFAULT true,
  license_tier TEXT DEFAULT 'basic', -- 'basic', 'premium', 'enterprise'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Statistiky
  usage_count INTEGER DEFAULT 0
);

-- Index pro rychlé vyhledávání
CREATE INDEX IF NOT EXISTS idx_vividbooks_assets_type ON vividbooks_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_vividbooks_assets_category ON vividbooks_assets(category);
CREATE INDEX IF NOT EXISTS idx_vividbooks_assets_tags ON vividbooks_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_vividbooks_assets_name ON vividbooks_assets(name);
CREATE INDEX IF NOT EXISTS idx_vividbooks_assets_active ON vividbooks_assets(is_active);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_vividbooks_assets_search ON vividbooks_assets 
  USING GIN(to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(ai_description, '')));

-- 2. Tabulka pro kategorie assetů
CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL, -- Zobrazovaný název
  icon TEXT, -- Název ikony (lucide)
  color TEXT, -- Hex barva
  parent_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabulka pro sledování použití assetů (pro licenční kontrolu)
CREATE TABLE IF NOT EXISTS asset_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Který asset
  asset_id UUID NOT NULL REFERENCES vividbooks_assets(id) ON DELETE CASCADE,
  
  -- Kdo ho použil
  user_id TEXT NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  
  -- Kde je použit
  content_type TEXT NOT NULL, -- 'board', 'worksheet', 'document'
  content_id TEXT NOT NULL,
  
  -- Kdy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Jedinečný záznam pro každé použití
  UNIQUE(asset_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_usage_asset ON asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_user ON asset_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_school ON asset_usage(school_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_content ON asset_usage(content_type, content_id);

-- 4. Rozšíření licenční tabulky o podporu asset licencí
-- Předpokládám, že máme school_licenses tabulku
ALTER TABLE school_licenses ADD COLUMN IF NOT EXISTS asset_license_tier TEXT DEFAULT 'basic';
ALTER TABLE school_licenses ADD COLUMN IF NOT EXISTS asset_license_expires_at TIMESTAMPTZ;

-- 5. Funkce pro kontrolu licence
CREATE OR REPLACE FUNCTION check_asset_license(
  p_asset_id UUID,
  p_user_id TEXT,
  p_school_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_asset RECORD;
  v_license RECORD;
BEGIN
  -- Získat informace o assetu
  SELECT * INTO v_asset FROM vividbooks_assets WHERE id = p_asset_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Asset bez licence je vždy přístupný
  IF NOT v_asset.license_required THEN
    RETURN true;
  END IF;
  
  -- Pokud je zadána škola, zkontrolovat licenci školy
  IF p_school_id IS NOT NULL THEN
    SELECT * INTO v_license 
    FROM school_licenses 
    WHERE school_id = p_school_id 
      AND (asset_license_expires_at IS NULL OR asset_license_expires_at > NOW());
    
    IF FOUND THEN
      -- Zkontrolovat tier
      IF v_asset.license_tier = 'basic' THEN
        RETURN true;
      ELSIF v_asset.license_tier = 'premium' AND v_license.asset_license_tier IN ('premium', 'enterprise') THEN
        RETURN true;
      ELSIF v_asset.license_tier = 'enterprise' AND v_license.asset_license_tier = 'enterprise' THEN
        RETURN true;
      END IF;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 6. View pro assety s licenční informací (pro admina)
CREATE OR REPLACE VIEW vividbooks_assets_admin AS
SELECT 
  a.*,
  (SELECT COUNT(*) FROM asset_usage u WHERE u.asset_id = a.id) as total_usage_count
FROM vividbooks_assets a;

-- 7. Trigger pro aktualizaci updated_at
CREATE OR REPLACE FUNCTION update_vividbooks_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vividbooks_assets_updated_at
  BEFORE UPDATE ON vividbooks_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_vividbooks_assets_updated_at();

-- 8. RLS policies
ALTER TABLE vividbooks_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_usage ENABLE ROW LEVEL SECURITY;

-- Všichni mohou číst aktivní assety
CREATE POLICY "Anyone can read active assets" ON vividbooks_assets
  FOR SELECT USING (is_active = true);

-- Pouze admin může měnit assety (přidáme admin check později)
CREATE POLICY "Admin can manage assets" ON vividbooks_assets
  FOR ALL USING (true); -- TODO: Přidat admin check

-- Uživatelé mohou vidět své usage záznamy
CREATE POLICY "Users can view own usage" ON asset_usage
  FOR SELECT USING (user_id = current_user);

-- Uživatelé mohou přidávat usage záznamy
CREATE POLICY "Users can insert usage" ON asset_usage
  FOR INSERT WITH CHECK (true);

-- ============================================
-- Počáteční data - kategorie
-- ============================================
INSERT INTO asset_categories (name, label, icon, color, position) VALUES
  ('matematika', 'Matematika', 'Calculator', '#3B82F6', 1),
  ('fyzika', 'Fyzika', 'Atom', '#8B5CF6', 2),
  ('chemie', 'Chemie', 'FlaskConical', '#10B981', 3),
  ('biologie', 'Biologie', 'Leaf', '#22C55E', 4),
  ('geografie', 'Zeměpis', 'Globe', '#F59E0B', 5),
  ('dejepis', 'Dějepis', 'Landmark', '#EF4444', 6),
  ('jazyky', 'Jazyky', 'Languages', '#EC4899', 7),
  ('informatika', 'Informatika', 'Code', '#6366F1', 8),
  ('obecne', 'Obecné', 'Shapes', '#64748B', 99)
ON CONFLICT (name) DO NOTHING;

-- 9. RPC funkce pro inkrementaci počítadla použití
CREATE OR REPLACE FUNCTION increment_asset_usage(p_asset_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE vividbooks_assets 
  SET usage_count = usage_count + 1 
  WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Příklad dat - několik assetů pro testování
-- ============================================
INSERT INTO vividbooks_assets (name, description, asset_type, file_url, category, tags) VALUES
  ('Trojúhelník', 'Animace konstrukce trojúhelníku', 'animation', '/assets/animations/triangle.json', 'matematika', '["geometrie", "trojúhelník", "konstrukce"]'),
  ('Násobení', 'Vizualizace násobení čísel', 'animation', '/assets/animations/multiplication.json', 'matematika', '["aritmetika", "násobení", "čísla"]'),
  ('Atom', 'Struktura atomu', 'image', '/assets/images/atom.png', 'fyzika', '["atom", "částice", "struktura"]'),
  ('Smajlík', 'Animovaná nálepka smajlík', 'sticker', '/assets/stickers/smiley.json', 'obecne', '["smajlík", "emoji", "reakce"]'),
  ('Šipka doprava', 'SVG symbol šipky', 'symbol', '/assets/symbols/arrow-right.svg', 'obecne', '["šipka", "navigace"]')
ON CONFLICT DO NOTHING;

