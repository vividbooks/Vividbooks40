-- ============================================
-- VYČIŠTĚNÍ BASE64 OBRÁZKŮ Z topic_data_sets
-- ============================================
-- Tyto obrázky zabírají 110+ MB a způsobují Disk IO problémy!
-- Po spuštění budou obrázky k dispozici pouze v Supabase Storage.
-- ============================================

-- 1. Zjisti velikost před čištěním
SELECT 
  'PŘED ČIŠTĚNÍM' as stage,
  COUNT(*) as dataset_count,
  pg_size_pretty(SUM(pg_column_size(media))) as media_total_size
FROM topic_data_sets 
WHERE media IS NOT NULL;

-- 2. Vyčisti generatedIllustrations (base64 data)
UPDATE topic_data_sets
SET media = media - 'generatedIllustrations'
WHERE media ? 'generatedIllustrations';

-- 3. Vyčisti generatedPhotos (base64 data)  
UPDATE topic_data_sets
SET media = media - 'generatedPhotos'
WHERE media ? 'generatedPhotos';

-- 4. Zjisti velikost po čištění
SELECT 
  'PO ČIŠTĚNÍ' as stage,
  COUNT(*) as dataset_count,
  pg_size_pretty(SUM(pg_column_size(media))) as media_total_size
FROM topic_data_sets 
WHERE media IS NOT NULL;

-- 5. Spusť VACUUM pro uvolnění místa
-- VACUUM (VERBOSE) topic_data_sets;
-- Poznámka: VACUUM běží automaticky, ale můžeš ho spustit manuálně pro okamžité uvolnění

