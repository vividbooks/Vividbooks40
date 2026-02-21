-- =====================================================
-- Přidání sloupce section_images do teacher_documents
-- Pro ukládání přiřazení obrázků k H2 nadpisům
-- =====================================================

-- Přidat sloupec section_images jako JSONB
ALTER TABLE teacher_documents 
ADD COLUMN IF NOT EXISTS section_images JSONB DEFAULT '[]'::jsonb;

-- Komentář
COMMENT ON COLUMN teacher_documents.section_images IS 'Array of {heading, imageUrl, imageTitle} for H2 section images';
