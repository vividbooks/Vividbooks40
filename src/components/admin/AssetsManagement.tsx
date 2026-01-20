/**
 * Admin Assets Management
 * 
 * Správa Vividbooks assets pro administrátory:
 * - Přehled všech assetů
 * - Nahrávání nových assetů
 * - Editace tagů a metadat
 * - Správa licencí
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Film,
  Image as ImageIcon,
  Sticker,
  Shapes,
  Upload,
  Loader2,
  MoreVertical,
  Check,
  X,
  Tag,
  BarChart2,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import type { VividbooksAsset, AssetType, AssetCategory, LicenseTier } from '../../types/assets';
import { toast } from 'sonner';

// ============================================
// CONSTANTS
// ============================================

const ASSET_TYPE_ICONS: Record<AssetType, React.ReactNode> = {
  animation: <Film className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
  sticker: <Sticker className="w-4 h-4" />,
  symbol: <Shapes className="w-4 h-4" />,
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  animation: 'Animace',
  image: 'Obrázek',
  sticker: 'Nálepka',
  symbol: 'Symbol',
};

const LICENSE_TIER_LABELS: Record<LicenseTier, string> = {
  basic: 'Základní',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

const LICENSE_TIER_COLORS: Record<LicenseTier, string> = {
  basic: 'bg-slate-100 text-slate-700',
  premium: 'bg-amber-100 text-amber-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

// ============================================
// TYPES
// ============================================

interface AssetFormData {
  name: string;
  description: string;
  assetType: AssetType;
  fileUrl: string;
  thumbnailUrl: string;
  category: string;
  tags: string[];
  licenseTier: LicenseTier;
  licenseRequired: boolean;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function AssetCard({ 
  asset, 
  onEdit, 
  onDelete,
  onView,
}: { 
  asset: VividbooksAsset; 
  onEdit: () => void; 
  onDelete: () => void;
  onView: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div 
        className="aspect-video bg-slate-100 relative cursor-pointer"
        onClick={onView}
      >
        <img
          src={asset.thumbnailUrl || asset.fileUrl}
          alt={asset.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Type badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-white/90 rounded-lg text-xs font-medium">
          {ASSET_TYPE_ICONS[asset.assetType]}
          {ASSET_TYPE_LABELS[asset.assetType]}
        </div>

        {/* License badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold ${LICENSE_TIER_COLORS[asset.licenseTier]}`}>
          {LICENSE_TIER_LABELS[asset.licenseTier]}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-800 truncate">{asset.name}</h3>
            <p className="text-sm text-slate-500 truncate">{asset.category || 'Bez kategorie'}</p>
          </div>
          
          {/* Actions menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-slate-200 z-20 min-w-[120px]">
                  <button
                    onClick={() => { onView(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" />
                    Zobrazit
                  </button>
                  <button
                    onClick={() => { onEdit(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="w-4 h-4" />
                    Upravit
                  </button>
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Smazat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {asset.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                {tag}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3" />
            {asset.usageCount} použití
          </span>
          {!asset.isActive && (
            <span className="text-red-500 font-medium">Neaktivní</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetModal({
  asset,
  onClose,
  onSave,
  categories,
}: {
  asset?: VividbooksAsset;
  onClose: () => void;
  onSave: (data: AssetFormData, id?: string) => Promise<void>;
  categories: AssetCategory[];
}) {
  const [formData, setFormData] = useState<AssetFormData>({
    name: asset?.name || '',
    description: asset?.description || '',
    assetType: asset?.assetType || 'image',
    fileUrl: asset?.fileUrl || '',
    thumbnailUrl: asset?.thumbnailUrl || '',
    category: asset?.category || '',
    tags: asset?.tags || [],
    licenseTier: asset?.licenseTier || 'basic',
    licenseRequired: asset?.licenseRequired ?? true,
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.fileUrl) {
      toast.error('Vyplňte název a URL souboru');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData, asset?.id);
      onClose();
    } catch (err) {
      console.error('Error saving asset:', err);
      toast.error('Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {asset ? 'Upravit asset' : 'Nový asset'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Název *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              placeholder="Název assetu"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Popis
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
              rows={2}
              placeholder="Popis assetu pro vyhledávání"
            />
          </div>

          {/* Type and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Typ *
              </label>
              <select
                value={formData.assetType}
                onChange={(e) => setFormData(prev => ({ ...prev, assetType: e.target.value as AssetType }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kategorie
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="">Bez kategorie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* File URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              URL souboru *
            </label>
            <input
              type="text"
              value={formData.fileUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              placeholder="https://..."
            />
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              URL náhledu
            </label>
            <input
              type="text"
              value={formData.thumbnailUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              placeholder="https://... (pro animace)"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tagy
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                placeholder="Přidat tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-indigo-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* License */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Licenční tier
              </label>
              <select
                value={formData.licenseTier}
                onChange={(e) => setFormData(prev => ({ ...prev, licenseTier: e.target.value as LicenseTier }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                {Object.entries(LICENSE_TIER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.licenseRequired}
                  onChange={(e) => setFormData(prev => ({ ...prev, licenseRequired: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Vyžaduje licenci</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {asset ? 'Uložit změny' : 'Vytvořit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AssetsManagement() {
  const [assets, setAssets] = useState<VividbooksAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<VividbooksAsset | undefined>();

  // Load assets
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vividbooks_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('asset_type', typeFilter);
      }

      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAssets((data || []).map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        assetType: row.asset_type,
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
      })));
    } catch (err) {
      console.error('Error loading assets:', err);
      toast.error('Chyba při načítání assetů');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('asset_categories')
        .select('*')
        .order('position');

      if (error) throw error;

      setCategories((data || []).map(row => ({
        id: row.id,
        name: row.name,
        label: row.label,
        icon: row.icon,
        color: row.color,
        parentId: row.parent_id,
        position: row.position || 0,
      })));
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, []);

  useEffect(() => {
    loadAssets();
    loadCategories();
  }, [loadAssets, loadCategories]);

  // Save asset
  const handleSave = useCallback(async (data: AssetFormData, id?: string) => {
    const payload = {
      name: data.name,
      description: data.description,
      asset_type: data.assetType,
      file_url: data.fileUrl,
      thumbnail_url: data.thumbnailUrl || null,
      category: data.category || null,
      tags: data.tags,
      license_tier: data.licenseTier,
      license_required: data.licenseRequired,
    };

    if (id) {
      const { error } = await supabase
        .from('vividbooks_assets')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      toast.success('Asset byl aktualizován');
    } else {
      const { error } = await supabase
        .from('vividbooks_assets')
        .insert(payload);

      if (error) throw error;
      toast.success('Asset byl vytvořen');
    }

    await loadAssets();
  }, [loadAssets]);

  // Delete asset
  const handleDelete = useCallback(async (asset: VividbooksAsset) => {
    if (!confirm(`Opravdu chcete smazat "${asset.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('vividbooks_assets')
        .delete()
        .eq('id', asset.id);

      if (error) throw error;
      
      toast.success('Asset byl smazán');
      await loadAssets();
    } catch (err) {
      console.error('Error deleting asset:', err);
      toast.error('Chyba při mazání');
    }
  }, [loadAssets]);

  const handleEdit = (asset: VividbooksAsset) => {
    setEditingAsset(asset);
    setShowModal(true);
  };

  const handleView = (asset: VividbooksAsset) => {
    window.open(asset.fileUrl, '_blank');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Správa assetů</h1>
          <p className="text-slate-500">Animace, obrázky, nálepky a symboly Vividbooks</p>
        </div>
        
        <button
          onClick={() => { setEditingAsset(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nový asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat assety..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AssetType | 'all')}
            className="px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          >
            <option value="all">Všechny typy</option>
            {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={loadAssets}
          disabled={loading}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => {
          const count = assets.filter(a => a.assetType === type).length;
          return (
            <div 
              key={type}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
            >
              <div className="p-2 rounded-lg bg-slate-100">
                {ASSET_TYPE_ICONS[type as AssetType]}
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{count}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Assets grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-slate-200">
          <ImageIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500">Žádné assety nenalezeny</p>
          <button
            onClick={() => { setEditingAsset(undefined); setShowModal(true); }}
            className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
          >
            Vytvořit první asset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onEdit={() => handleEdit(asset)}
              onDelete={() => handleDelete(asset)}
              onView={() => handleView(asset)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AssetModal
          asset={editingAsset}
          onClose={() => { setShowModal(false); setEditingAsset(undefined); }}
          onSave={handleSave}
          categories={categories}
        />
      )}
    </div>
  );
}

export default AssetsManagement;




