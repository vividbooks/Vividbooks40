# Přenos bloku „Moje třída“ do jiného projektu

Tento dokument shrnuje **co zkopírovat**, **jaké závislosti musí cílový projekt mít**, a **v jakém pořadí** integrovat. Slouží jako příprava na přenos z Vividbooks40 do jiného repozitáře (stejný stack: Vite + React + Supabase).

Obrazovka **výsledků kvízu / relace** (agregace, přehled otázek): viz [QUIZ-RESULTS-INTEGRATION-HANDOFF.md](./QUIZ-RESULTS-INTEGRATION-HANDOFF.md).

---

## 1. Co je „jádro“ modulu

| Oblast | Cesta v tomto repu | Poznámka |
|--------|-------------------|----------|
| Feature modul | `src/features/moje-trida/` | Celá složka včetně `*.test.ts` |
| Migrace localStorage → DB | `src/utils/migration/` | `migrate-class-localstorage-to-supabase.ts`, `normalize-submission-preview-text.ts`, testy |
| Re-export migrace | `scripts/migrate-class-localstorage-to-supabase.ts` | Jen odkaz na `src/…` (volitelné) |
| Vitest | `vitest.config.ts` | + skripty `test`, `test:watch`, `ci` v `package.json` |
| CI | `.github/workflows/ci.yml` | Testy + `npm run build` |
| Env šablona | `.env.example` | Sekce `VITE_FF_*` a případně Supabase |

**Není to samostatný npm balíček** — počítej s úpravami importů a aliasu `@/` v cílovém projektu.

---

## 2. Supabase: migrace k přenesení / sladění schématu

V tomto repu jsou Moje-třída související změny rozprostřené v několika souborech. Na cílové DB aplikuj **stejné nebo ekvivalentní** SQL (názvy tabulek a sloupců musí sedět s kódem repozitářů).

**Doporučený minimální soubor migrací z tohoto projektu:**

| Soubor | Účel |
|--------|------|
| `supabase/migrations/20260328150000_teacher_class_preferences.sql` | Předvolby učitele (záložka, třída, quiz dismiss map) |
| `supabase/migrations/20260328150300_teacher_quiz_setup_dismissals.sql` | Sloupec `quiz_setup_dismissed_sessions` |
| `supabase/migrations/20260328150100_class_runtime_state.sql` | Runtime stav třídy (klíč/hodnota) |
| `supabase/migrations/20260328150200_student_content.sql` | Metadata obsahu žáka |
| `supabase/migrations/20260329100000_student_submissions_text_preview.sql` | Sloupec `text_preview` na `student_submissions` (pokud tabulka existuje) |
| `supabase/migrations/20260316_live_sessions.sql` (+ související) | `live_sessions` pro sdílení ve třídě (`kind = share`) |

**Tabulky používané kódem mimo čisté SQL v tomto repu** (musí v cílové DB existovat nebo je třeba upravit repozitáře):

- `classes`, `students` (základ tříd / žáků)
- `student_assignments`, `student_submissions` (úkoly a odevzdání — často zavedené mimo uvedené migrace; ověř v cílovém projektu)
- `auth.users` (FK u `teacher_class_preferences.user_id`)

**Pravidlo projektu:** do DB **nikdy base64** — u odevzdání používat `text_preview` jako plain text / strip (viz `stripBase64FromObject` před zápisem).

---

## 3. Proměnné prostředí (Vite)

```
VITE_FF_CLASSROOM_SHARE_SUPABASE   # sdílení dokumentu přes live_sessions
VITE_FF_MOJE_TRIDA_REPO_ONLY       # jen Supabase, bez legacy business dat
VITE_FF_MOJE_TRIDA_DUAL_WRITE      # zápis do Supabase + legacy
VITE_FF_MOJE_TRIDA_LEGACY_FALLBACK # čtení legacy při chybě DB

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Výchozí hodnoty flagů jsou v `src/features/moje-trida/integration/feature-flags.ts` (`envBool` + defaulty).

---

## 4. Aplikační závislosti (musí existovat nebo být nahrazeny)

Tyto moduly **nejsou** uvnitř `features/moje-trida`, ale feature na ně spoléhá:

| Modul | Účel |
|-------|------|
| `src/utils/supabase/client.ts` | Klient Supabase |
| `src/utils/supabase/classes.ts` | `isUsingSupabase()`, `getClasses`, … (volá `class-repository`) |
| `src/utils/supabase/upload-image.ts` | `stripBase64FromObject` — migrace a `syncSubmissionTextPreview` |
| `src/utils/student-assignments.ts` | Úkoly / odevzdání / `text_preview` |
| `src/types/student-assignment.ts` | Typy úkolů |
| `src/utils/live-session-repository.ts` | Sdílení ve třídě (`createClassroomDocumentShareSession`, `findActiveClassroomDocumentShareForClass`, …) |
| `src/contexts/ClassroomShareContext.tsx` | Stav sdílení; používá `getMojeTridaFlags().classroomShareSupabase` |
| `src/contexts/ViewModeContext.tsx` | Režim učitel/žák |
| `src/contexts/StudentAuthContext.tsx` | **Musí obalovat `ClassroomShareProvider`** (pořadí providerů) |

---

## 5. UI komponenty napojené na feature (přenos nebo náhrada)

Tyto soubory **importují** `features/moje-trida` nebo migraci — přenes je nebo přepoj importy.

| Soubor | Import |
|--------|--------|
| `src/components/MyClassesLayout.tsx` | `useMyClassesPreferences`, `useMyClassesClassesOverview`, `runMigrateClassLocalStorageToSupabase` |
| `src/components/MyContentLayout.tsx` | `useMyClassesClassesOverview`, `ClassSummary` |
| `src/components/classroom/TeacherSharePanel.tsx` | `useMyClassesClassesOverview` |
| `src/components/quiz/results/FirstTimeSetupDialog.tsx` | `persistQuizSetupDismissal` |
| `src/hooks/quiz/useClassSync.ts` | `isQuizSetupDismissed` |

Další související soubory (často úpravy kvůli Supabase / úkolům, ne vždy přímý import `moje-trida`):

- `src/components/classroom/AssignmentReview.tsx`, `ClassResultsGrid.tsx`
- `src/components/student/StudentAssignmentEditor.tsx`, `StudentWorkspace.tsx`, `StudentContentLayout.tsx`
- `src/components/classroom/AssignmentReview.tsx` — náhled z `text_preview`
- `src/main.tsx` — volitelně dev: `window.__VIVID_MIGRATE_CLASS_LS__`

---

## 6. Pořadí React providerů (důležité)

V `App.tsx` (nebo rootu) musí platit:

```text
ViewModeProvider
  → StudentAuthProvider
    → ClassroomShareProvider
      → Router / zbytek aplikace
```

`ClassroomShareProvider` používá `useStudentAuth()` pro načítání aktivního sdílení žákovi z Supabase.

---

## 7. Postup integrace v cílovém projektu (doporučené pořadí)

1. Zkopírovat `src/features/moje-trida/` a `src/utils/migration/`.
2. Přenést / sladit **Supabase migrace** a nasadit je na cílovou DB.
3. Doplnit **env** a ověřit `getSupabase` + `isUsingSupabase()`.
4. Zkopírovat nebo přizpůsobit **utils** z tabulky v sekci 4.
5. Napojit **MyClassesLayout** / routy a **provider pořadí** podle sekce 6.
6. Přidat **Vitest** + CI (`ci.yml`, skript `ci` v `package.json`), pokud je chceš stejné.
7. Jednorázově: tlačítko „Nahrát lokální data do cloudu“ nebo `runMigrateClassLocalStorageToSupabase()` po přihlášení učitele.

---

## 8. Ověření po přenosu

- [ ] Přihlášený učitel: načtení tříd, předvolby UI, migrace.
- [ ] Úkoly: vytvoření, odevzdání, `text_preview` u učitele v přehledu.
- [ ] Sdílení dokumentu: při `VITE_FF_CLASSROOM_SHARE_SUPABASE=true` aktivní řádek v `live_sessions`.
- [ ] Žák na jiném zařízení: aktivní session z cloudu (ClassroomShare + prefetch).
- [ ] `npm test` a `npm run build` v CI.

---

## 9. Omezení

- **Není zabaleno jako jeden balíček** — počítej s úpravami cest a případně s rozdílným schématem DB v cílovém projektu.
- **Telemetrie** a **ostrý `repoOnly`** nejsou součástí kódu jako „vždy zapnuto“ — to je provozní rozhodnutí.
- Stará data žáka **jen na jednom zařízení** (localStorage) se do cloudu **nedostanou**, dokud žák neuloží / nebo nespustíte migraci na tom stroji.

---

*Tento dokument odpovídá stavu větví v době přípravy přenosu; při merge do cílového projektu aktualizuj cesty a názvy tabulek podle skutečného schématu.*
