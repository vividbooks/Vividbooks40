/**
 * Dočasný most — čtení/zápis legacy klíčů (dual-write / fallback).
 * Odstranit po Phase 5 (FF_MOJE_TRIDA_REPO_ONLY + vypnutý dual-write).
 */

import type { MyClassesTab } from '../domain/types';

export const LEGACY_KEYS = {
  LAST_TAB: 'my-classes-last-tab',
  SELECTED_CLASS_ID: 'my-classes-selected-class-id',
  CLASSES_CACHE: 'vividbooks_classes_cache',
  CLASSES_CACHE_TIME: 'vividbooks_classes_cache_time',
} as const;

const CACHE_DURATION_MS = 5 * 60 * 1000;

export function legacyReadLastTab(): MyClassesTab | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEYS.LAST_TAB);
    if (raw === 'results' || raw === 'classes' || raw === 'individual') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function legacyWriteLastTab(tab: MyClassesTab): void {
  try {
    localStorage.setItem(LEGACY_KEYS.LAST_TAB, tab);
  } catch {
    /* quota */
  }
}

export function legacyReadSelectedClassId(): string | null {
  try {
    return localStorage.getItem(LEGACY_KEYS.SELECTED_CLASS_ID);
  } catch {
    return null;
  }
}

export function legacyWriteSelectedClassId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LEGACY_KEYS.SELECTED_CLASS_ID, id);
    else localStorage.removeItem(LEGACY_KEYS.SELECTED_CLASS_ID);
  } catch {
    /* ignore */
  }
}

export function legacyReadClassesCache(): { classes: unknown[]; ageMs: number } | null {
  try {
    const t = localStorage.getItem(LEGACY_KEYS.CLASSES_CACHE_TIME);
    const raw = localStorage.getItem(LEGACY_KEYS.CLASSES_CACHE);
    if (!t || !raw) return null;
    const cacheAge = Date.now() - parseInt(t, 10);
    if (!Number.isFinite(cacheAge) || cacheAge >= CACHE_DURATION_MS) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return { classes: parsed, ageMs: cacheAge };
  } catch {
    return null;
  }
}

export function legacyWriteClassesCache(classes: unknown[]): void {
  try {
    localStorage.setItem(LEGACY_KEYS.CLASSES_CACHE, JSON.stringify(classes));
    localStorage.setItem(LEGACY_KEYS.CLASSES_CACHE_TIME, Date.now().toString());
  } catch {
    /* quota */
  }
}

export const legacyClassesCacheTtlMs = CACHE_DURATION_MS;
