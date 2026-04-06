/**
 * Jednorázová migrace: legacy localStorage (Moje třída + úkoly) → Supabase.
 *
 * Nevolá se z Node — vyžaduje `window`, `localStorage` a přihlášeného učitele.
 * V dev: `await window.__VIVID_MIGRATE_CLASS_LS__?.()` (viz main.tsx).
 */

import { supabase } from '../supabase/client';
import { stripBase64FromObject } from '../supabase/upload-image';
import { isUsingSupabase } from '../supabase/classes';
import { LEGACY_KEYS } from '../../features/moje-trida/compat/legacy-my-classes-storage';
import {
  fetchTeacherClassPreferences,
  upsertTeacherClassPreferences,
} from '../../features/moje-trida/repositories/teacher-preferences-repository';
import type { MyClassesTab } from '../../features/moje-trida/domain/types';
import type { StudentAssignment, StudentSubmission } from '../../types/student-assignment';
import { syncSubmissionTextPreview } from '../student-assignments';

const ASSIGNMENTS_KEY = 'vivid-student-assignments';
const SUBMISSIONS_KEY = 'vivid-student-submissions';

export type MigrateClassLocalStorageResult = {
  ok: boolean;
  teacherPreferences: { ok: boolean; detail: string };
  assignments: { upserted: number; errors: string[] };
  submissions: { upserted: number; errors: string[] };
  /** Náhled textu z assignment_content_* / vivid-doc-* (stejné zařízení jako žák) */
  textPreviewBackfill: { updated: number; errors: string[] };
  warnings: string[];
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function collectQuizSetupDismissedFromLocalStorage(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('quiz_setup_dismissed_')) continue;
      const sessionId = k.slice('quiz_setup_dismissed_'.length);
      const v = localStorage.getItem(k);
      if (v === 'true' || v === '1') out[sessionId] = true;
    }
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Nahraje předvolby (záložka, třída, quiz dialog dismiss) a úkoly/odevzdané z localStorage do Supabase.
 */
export async function runMigrateClassLocalStorageToSupabase(): Promise<MigrateClassLocalStorageResult> {
  const warnings: string[] = [];
  const result: MigrateClassLocalStorageResult = {
    ok: true,
    teacherPreferences: { ok: false, detail: '' },
    assignments: { upserted: 0, errors: [] },
    submissions: { upserted: 0, errors: [] },
    textPreviewBackfill: { updated: 0, errors: [] },
    warnings,
  };

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    result.ok = false;
    result.teacherPreferences.detail = 'Jen v prohlížeči.';
    return result;
  }

  if (!isUsingSupabase()) {
    result.ok = false;
    result.teacherPreferences.detail = 'Zapněte Supabase (úložiště tříd).';
    return result;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    result.ok = false;
    result.teacherPreferences.detail = 'Přihlaste se jako učitel.';
    return result;
  }

  // --- teacher_class_preferences ---
  try {
    const lastRaw = localStorage.getItem(LEGACY_KEYS.LAST_TAB);
    const lastTab: MyClassesTab | null =
      lastRaw === 'results' || lastRaw === 'classes' || lastRaw === 'individual' ? lastRaw : null;
    const selectedRaw = localStorage.getItem(LEGACY_KEYS.SELECTED_CLASS_ID);
    const selectedClassId =
      selectedRaw && isUuid(selectedRaw) ? selectedRaw : null;
    if (selectedRaw && !selectedClassId) {
      warnings.push('Vybraná třída v legacy klíči není platné UUID — přeskočeno.');
    }

    const localQuiz = collectQuizSetupDismissedFromLocalStorage();
    const current = await fetchTeacherClassPreferences(user.id);
    const mergedQuiz = {
      ...(current?.quiz_setup_dismissed_sessions || {}),
      ...localQuiz,
    };

    const ok = await upsertTeacherClassPreferences({
      user_id: user.id,
      last_tab: lastTab ?? (current?.last_tab as MyClassesTab | null) ?? null,
      selected_class_id: selectedClassId ?? current?.selected_class_id ?? null,
      quiz_setup_dismissed_sessions: mergedQuiz,
    });
    result.teacherPreferences = {
      ok,
      detail: ok
        ? 'Předvolby uloženy (last_tab, selected_class, quiz dismiss map).'
        : 'Uložení předvoleb selhalo (viz konzoli).',
    };
    if (!ok) result.ok = false;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.teacherPreferences = { ok: false, detail: msg };
    result.ok = false;
  }

  // --- student_assignments ---
  const assignments = readJsonArray<StudentAssignment>(ASSIGNMENTS_KEY);
  for (const a of assignments) {
    const row = stripBase64FromObject(
      {
        id: a.id,
        class_id: a.class_id,
        title: a.title,
        description: a.description,
        type: a.type,
        allow_ai: a.allow_ai,
        due_date: a.due_date ?? null,
        created_by: a.created_by,
        created_at: a.created_at,
        subject: a.subject ?? null,
        ...(a.max_points !== undefined ? { max_points: a.max_points } : {}),
      },
      'student_assignments',
    ) as Record<string, unknown>;

    const { error } = await supabase.from('student_assignments').upsert(row, { onConflict: 'id' });
    if (error) {
      result.assignments.errors.push(`${a.id}: ${error.message}`);
    } else {
      result.assignments.upserted += 1;
    }
  }
  if (assignments.length === 0) {
    warnings.push('Žádné záznamy v vivid-student-assignments.');
  }

  // --- student_submissions ---
  const submissions = readJsonArray<StudentSubmission>(SUBMISSIONS_KEY);
  for (const s of submissions) {
    const row = stripBase64FromObject(
      {
        id: s.id,
        student_id: s.student_id,
        assignment_id: s.assignment_id,
        content_type: s.content_type,
        content_id: s.content_id,
        status: s.status,
        started_at: s.started_at,
        submitted_at: s.submitted_at ?? null,
        ai_flags: s.ai_flags ?? [],
        ai_warning_shown: s.ai_warning_shown ?? false,
        score: s.score ?? null,
        max_score: s.max_score ?? null,
        teacher_comment: s.teacher_comment ?? null,
        graded_at: s.graded_at ?? null,
        graded_by: s.graded_by ?? null,
        ...(s.text_preview?.trim() ? { text_preview: s.text_preview } : {}),
      },
      'student_submissions',
    ) as Record<string, unknown>;

    const { error } = await supabase.from('student_submissions').upsert(row, { onConflict: 'id' });
    if (error) {
      result.submissions.errors.push(`${s.id}: ${error.message}`);
    } else {
      result.submissions.upserted += 1;
    }
  }
  if (submissions.length === 0) {
    warnings.push('Žádné záznamy v vivid-student-submissions.');
  }

  if (submissions.length > 0) {
    for (const s of submissions) {
      const body = readLocalSubmissionBodyForPreview(s);
      if (!body?.trim()) continue;
      try {
        await syncSubmissionTextPreview(s.id, body);
        result.textPreviewBackfill.updated += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.textPreviewBackfill.errors.push(`${s.id}: ${msg}`);
      }
    }
  }

  if (result.assignments.errors.length || result.submissions.errors.length) {
    result.ok = false;
  }

  return result;
}

declare global {
  interface Window {
    __VIVID_MIGRATE_CLASS_LS__?: typeof runMigrateClassLocalStorageToSupabase;
  }
}
