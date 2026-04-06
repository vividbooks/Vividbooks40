/**
 * Jednorázová migrace localStorage → Supabase (Moje třída, úkoly).
 *
 * Nevolá se z Node — migrace běží v prohlížeči s přihlášeným učitelem.
 * Dev: `await window.__VIVID_MIGRATE_CLASS_LS__?.()`
 *
 * Implementace: `src/utils/migration/migrate-class-localstorage-to-supabase.ts`
 */

export {
  runMigrateClassLocalStorageToSupabase,
  type MigrateClassLocalStorageResult,
} from '../src/utils/migration/migrate-class-localstorage-to-supabase';
