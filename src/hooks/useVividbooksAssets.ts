/**
 * Hook pro práci s Vividbooks assets
 * 
 * Načítání, vyhledávání a filtrování assetů z databáze
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import type { 
  VividbooksAsset, 
  AssetCategory, 
  VividbooksAssetFilter,
  AssetType,
  AssetUsage 
} from '../types/assets';
import * as storage from '../utils/profile-storage';

// Mapování z DB row na TypeScript objekt
function mapAssetFromDb(row: any): VividbooksAsset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    assetType: row.asset_type as AssetType,
    fileUrl: row.file_url,
    thumbnailUrl: row.thumbnail_url,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    category: row.category,
    subcategory: row.subcategory,
    tags: row.tags || [],
    aiDescription: row.ai_description,
    licenseRequired: row.license_required ?? true,
    licenseTier: row.license_tier || 'basic',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active ?? true,
    usageCount: row.usage_count || 0,
  };
}

function mapCategoryFromDb(row: any): AssetCategory {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    icon: row.icon,
    color: row.color,
    parentId: row.parent_id,
    position: row.position || 0,
  };
}

export function useVividbooksAssets() {
  const [assets, setAssets] = useState<VividbooksAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Získat aktuální uživatele a školu
  const getCurrentUserInfo = useCallback(() => {
    const profile = storage.getCurrentUserProfile();
    const school = storage.getCurrentSchool();
    return {
      userId: profile?.userId || profile?.id || 'anonymous',
      schoolId: school?.id || null,
    };
  }, []);

  // Načíst kategorie
  const loadCategories = useCallback(async () => {
    try {
      console.log('[useVividbooksAssets] Loading categories...');
      const { data, error: fetchError } = await supabase
        .from('asset_categories')
        .select('*')
        .order('position');

      if (fetchError) {
        console.error('[useVividbooksAssets] Error loading categories:', fetchError.message, fetchError.code, fetchError.details);
        return;
      }

      console.log('[useVividbooksAssets] Categories loaded:', data?.length || 0);
      setCategories((data || []).map(mapCategoryFromDb));
    } catch (err) {
      console.error('[useVividbooksAssets] Exception loading categories:', err);
    }
  }, []);

  // Načíst assety s filtrem
  const loadAssets = useCallback(async (filter: VividbooksAssetFilter = {}, limit = 50, offset = 0) => {
    setLoading(true);
    setError(null);

    console.log('[useVividbooksAssets] Loading assets with filter:', filter);

    try {
      let query = supabase
        .from('vividbooks_assets')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .order('name');

      // Filtr podle typu
      if (filter.assetType && filter.assetType !== 'all') {
        query = query.eq('asset_type', filter.assetType);
      }

      // Filtr podle kategorie
      if (filter.category) {
        query = query.eq('category', filter.category);
      }

      // Filtr podle licence tier
      if (filter.licenseTier) {
        query = query.eq('license_tier', filter.licenseTier);
      }

      // Vyhledávání
      if (filter.search && filter.search.trim()) {
        const searchTerm = filter.search.trim().toLowerCase();
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,ai_description.ilike.%${searchTerm}%`);
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        const errorMsg = `${fetchError.message} (code: ${fetchError.code})`;
        setError(errorMsg);
        console.error('[useVividbooksAssets] Error loading assets:', fetchError.message, fetchError.code, fetchError.details, fetchError.hint);
        return;
      }

      console.log('[useVividbooksAssets] Assets loaded:', data?.length || 0, 'total:', count);
      const mappedAssets = (data || []).map(mapAssetFromDb);
      setAssets(mappedAssets);
      setTotalCount(count || 0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Neznámá chyba';
      setError(errorMsg);
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Vyhledat assety
  const searchAssets = useCallback(async (searchTerm: string, assetType?: AssetType) => {
    return loadAssets({ search: searchTerm, assetType: assetType || 'all' });
  }, [loadAssets]);

  // Získat asset podle ID
  const getAssetById = useCallback(async (assetId: string): Promise<VividbooksAsset | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('vividbooks_assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (fetchError || !data) {
        console.error('Error fetching asset:', fetchError);
        return null;
      }

      return mapAssetFromDb(data);
    } catch (err) {
      console.error('Error fetching asset:', err);
      return null;
    }
  }, []);

  // Zaznamenat použití assetu
  const recordAssetUsage = useCallback(async (
    assetId: string, 
    contentType: 'board' | 'worksheet' | 'document',
    contentId: string
  ): Promise<boolean> => {
    const { userId, schoolId } = getCurrentUserInfo();

    try {
      const { error: insertError } = await supabase
        .from('asset_usage')
        .upsert({
          asset_id: assetId,
          user_id: userId,
          school_id: schoolId,
          content_type: contentType,
          content_id: contentId,
        }, { onConflict: 'asset_id,content_type,content_id' });

      if (insertError) {
        console.error('Error recording asset usage:', insertError);
        return false;
      }

      // Inkrementovat počítadlo použití
      await supabase.rpc('increment_asset_usage', { p_asset_id: assetId });

      return true;
    } catch (err) {
      console.error('Error recording asset usage:', err);
      return false;
    }
  }, [getCurrentUserInfo]);

  // Zkontrolovat licenci pro asset
  const checkAssetLicense = useCallback(async (assetId: string): Promise<boolean> => {
    const { userId, schoolId } = getCurrentUserInfo();

    try {
      // Nejdříve načíst asset
      const asset = await getAssetById(assetId);
      if (!asset) return false;

      // Pokud asset nevyžaduje licenci, je přístupný
      if (!asset.licenseRequired) return true;

      // Pokud není škola, nemá licenci
      if (!schoolId) return false;

      // Zkontrolovat licenci školy
      const { data: license, error: licenseError } = await supabase
        .from('school_licenses')
        .select('asset_license_tier, asset_license_expires_at')
        .eq('school_id', schoolId)
        .single();

      if (licenseError || !license) return false;

      // Zkontrolovat expiraci
      if (license.asset_license_expires_at) {
        const expiresAt = new Date(license.asset_license_expires_at);
        if (expiresAt < new Date()) return false;
      }

      // Zkontrolovat tier
      const tierOrder = { basic: 1, premium: 2, enterprise: 3 };
      const requiredTier = tierOrder[asset.licenseTier] || 1;
      const hasTier = tierOrder[license.asset_license_tier as keyof typeof tierOrder] || 0;

      return hasTier >= requiredTier;
    } catch (err) {
      console.error('Error checking asset license:', err);
      return false;
    }
  }, [getCurrentUserInfo, getAssetById]);

  // Načíst kategorie při inicializaci
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    assets,
    categories,
    loading,
    error,
    totalCount,
    loadAssets,
    searchAssets,
    getAssetById,
    recordAssetUsage,
    checkAssetLicense,
    loadCategories,
  };
}

export default useVividbooksAssets;


