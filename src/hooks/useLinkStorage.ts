import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';
import { storage } from '../utils/profile-storage';
import { StoredLink } from '../types/file-storage';
import { syncLinksFromSupabase, saveLink as saveLinkToStorage, deleteLink as deleteLinkToStorage, migrateLinksToSupabase } from '../utils/link-storage';

const LINKS_KEY = 'vivid-my-links';

/**
 * Hook for managing teacher link storage with Supabase sync
 */
export function useLinkStorage() {
  const [links, setLinks] = useState<StoredLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Get current user ID
  const getUserId = useCallback(() => {
    const profile = storage.getCurrentUserProfile();
    return profile?.userId || profile?.id || null;
  }, []);

  // Load links from localStorage (for sync events)
  const loadLinksFromLocalStorage = useCallback(() => {
    const localLinks = localStorage.getItem(LINKS_KEY);
    if (localLinks) {
      try {
        setLinks(JSON.parse(localLinks));
      } catch (e) {}
    }
  }, []);

  // Load links - localStorage first, then sync from Supabase
  const loadLinks = useCallback(async () => {
    const userId = getUserId();
    
    console.log('[LinkStorage] Loading links for userId:', userId);
    
    // ALWAYS load from localStorage first (instant)
    const localLinks = localStorage.getItem(LINKS_KEY);
    if (localLinks) {
      try {
        const parsed = JSON.parse(localLinks);
        console.log('[LinkStorage] Loaded from localStorage:', parsed.length, 'links');
        setLinks(parsed);
      } catch (e) {
        console.error('[LinkStorage] Failed to parse localStorage:', e);
      }
    }
    setLoading(false);
    
    // Then sync from Supabase in background using the canonical storage module (handles deletes safely)
    if (userId) {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        await syncLinksFromSupabase(userId, token);
      } catch (err) {
        console.error('[LinkStorage] Sync error:', err);
      }
    }
  }, [getUserId]);

  // Listen for links-updated events
  useEffect(() => {
    const handleLinksUpdated = () => {
      console.log('[useLinkStorage] Links updated event received');
      loadLinksFromLocalStorage();
    };
    
    window.addEventListener('links-updated', handleLinksUpdated);
    window.addEventListener('content-updated', handleLinksUpdated);
    
    return () => {
      window.removeEventListener('links-updated', handleLinksUpdated);
      window.removeEventListener('content-updated', handleLinksUpdated);
    };
  }, [loadLinksFromLocalStorage]);

  // Save link to Supabase
  const saveLink = useCallback(async (link: StoredLink): Promise<boolean> => {
    // Update local state immediately
    setLinks(prev => {
      const existingIndex = prev.findIndex(l => l.id === link.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = link;
        return updated;
      }
      return [link, ...prev];
    });

    // Save to localStorage
    const allLinks = [...links.filter(l => l.id !== link.id), link];
    localStorage.setItem(LINKS_KEY, JSON.stringify(allLinks));

    // Save via canonical storage module (includes reliable Supabase sync)
    saveLinkToStorage(link);
    return true;
  }, [links]);

  // Delete link
  const deleteLink = useCallback(async (linkId: string): Promise<boolean> => {
    // Update local state
    const updatedLinks = links.filter(l => l.id !== linkId);
    setLinks(updatedLinks);
    localStorage.setItem(LINKS_KEY, JSON.stringify(updatedLinks));
    deleteLinkToStorage(linkId);

    return true;
  }, [links]);

  // Move link to folder
  const moveLinkToFolder = useCallback(async (linkId: string, folderId: string | null): Promise<boolean> => {
    // Update local state
    setLinks(prev => prev.map(l => 
      l.id === linkId ? { ...l, folderId } : l
    ));
    
    // Update localStorage
    const updatedLinks = links.map(l => 
      l.id === linkId ? { ...l, folderId } : l
    );
    localStorage.setItem(LINKS_KEY, JSON.stringify(updatedLinks));

    // Persist via canonical storage module
    const moved = updatedLinks.find(l => l.id === linkId);
    if (moved) saveLinkToStorage(moved);

    return true;
  }, [links]);

  // Update link (e.g., add transcript)
  const updateLink = useCallback(async (linkId: string, updates: Partial<StoredLink>): Promise<boolean> => {
    // Update local state
    setLinks(prev => prev.map(l => 
      l.id === linkId ? { ...l, ...updates } : l
    ));
    
    // Update localStorage
    const updatedLinks = links.map(l => 
      l.id === linkId ? { ...l, ...updates } : l
    );
    localStorage.setItem(LINKS_KEY, JSON.stringify(updatedLinks));
    const updated = updatedLinks.find(l => l.id === linkId);
    if (updated) saveLinkToStorage(updated);

    return true;
  }, [links]);

  // Get links in root (not in any folder)
  const getRootLinks = useCallback(() => {
    return links.filter(l => !l.folderId);
  }, [links]);

  // Get links in a specific folder
  const getLinksInFolder = useCallback((folderId: string) => {
    return links.filter(l => l.folderId === folderId);
  }, [links]);

  // Migrate localStorage to Supabase
  const migrateToSupabase = useCallback(async (): Promise<{ success: boolean; migrated: number }> => {
    return await migrateLinksToSupabase();
  }, []);

  // Load links on mount
  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  return {
    links,
    loading,
    saveLink,
    deleteLink,
    updateLink,
    moveLinkToFolder,
    getRootLinks,
    getLinksInFolder,
    migrateToSupabase,
    refresh: loadLinks,
  };
}


