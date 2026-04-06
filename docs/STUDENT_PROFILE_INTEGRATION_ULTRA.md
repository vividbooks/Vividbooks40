# Integrace studentského profilu / dashboardu (VividBooks Ultra + mapování z Vividbooks40)

Tento dokument popisuje **cílovou architekturu** repozitáře **vividbooks-ultra** a zároveň **mapuje modul žáka** ze **starší aplikace (Vividbooks40)** tak, aby tým nebo agent věděl, co přenášet a kam to v Ultra „sedí“.

---

## 1. Struktura monorepo (Ultra)

| Část | Účel |
|------|------|
| `frontend/` | React (Vite), hlavní uživatelské rozhraní |
| `supabase/` | Migrace, Edge Functions — **produkční HTTP API** (`functions/api`) |
| `backend/` | Legacy Node + Hono — lokální kompatibilita; dev proxy z Vite na `localhost:3000` pod `/api` |
| `docs/` | Architektonické přehledy (`ARCHITECTURE.md`, `MONOREPO_STRUCTURE.md`, `SESSION_RESULTS_INTEGRATION_SPEC.md`, …) |

**Runtime model (Ultra):**

- Frontend: React + Vite (`frontend/`).
- API v produkci: Hono jako **Supabase Edge Function** (`supabase/functions/api`).
- Datová platforma: **Supabase** (Postgres, Auth, Storage, Realtime).
- Legacy lokální `backend/` — vývoj; produkce přes Supabase.

Podrobněji v Ultra: `docs/ARCHITECTURE.md`, `docs/MONOREPO_STRUCTURE.md`.

**Vividbooks40 (zdroj):** jeden Vite projekt v rootu (`src/`), bez stejného rozdělení `frontend/` — při přenosu cesty přemapovat na `frontend/src/...` a alias `@/`.

---

## 2. Frontend — vstup a vrstvy (Ultra)

| Soubor (Ultra) | Role |
|------------------|------|
| `frontend/src/main.tsx` | Mount, `BrowserRouter` |
| `frontend/src/App.tsx` | Globální providery včetně **`StudentAuthProvider`**, `ClassroomShareProvider`, routy |
| `frontend/src/router.tsx` | **Jednotný zdroj rout**, lazy loading, shelly učitele a žáka |

**Doporučené vrstvy (Ultra):**

- Routy → `src/app/pages/`
- Doménové UI → `src/app/components/` (včetně `views/`)
- UI primitiva → `src/components/ui/`, shell → `src/components/`
- Data → `src/app/services/`, `src/app/utils/`
- Typy → `src/app/types/`
- Obal stránky → `src/app/layouts/PageLayout.tsx`

Import alias: `@/` → `frontend/src/`.

**Mapování z V40:**

| Koncept | Vividbooks40 (aktuální repo) |
|---------|-----------------------------|
| Globální mount | `src/main.tsx` |
| Providery + routy | `src/App.tsx` — `ViewModeProvider` → `StudentAuthProvider` → `ClassroomShareProvider` → `Router` |
| Routy | Rozptýlené v `App.tsx` (ne jeden `router.tsx`) — při portu sloučit do Ultra `router.tsx` |

---

## 3. Rozdělení rout: učitel × žák (Ultra)

- **Učitel:** strom pod `/`, `TeacherShell` + `RequireAuth`.
- **Žák:** **`/student/...`**, `StudentShell` + **`RequireStudentAuth`**.
- Kanonické segmenty přihlášení: `APP_ROUTE_SEGMENTS` v `app/utils/app-route.ts`, **`canonicalizeAppPathname`** (aliasy cs/en).

**Výjimky bez plného studentského přihlášení (Ultra):** např. sdílená tabule, query `liveSessionId` — viz `RequireStudentAuth.tsx`.

**Mapování z V40 — žákovské routy (zdroj pro přenos):**

| V40 cesta | Komponenta | Poznámka pro Ultra |
|-----------|------------|----------------------|
| `/student/login` | `StudentLoginPage` | Sladit s `/{prihlaseni}/{student}` |
| `/student/setup/:token` | `StudentSetupPassword` | Dokončení účtu |
| `/student/dashboard` | `StudentDashboard` | Zvážit sloučení s `pracovna` / `nastenka` |
| `/student/workspace`, `/student/my-content` | `StudentContentLayout` | Odpovídá konceptu **pracovna** (`StudentContentPage` v Ultra) |
| `/student/assignment/:assignmentId` | `StudentAssignmentEditor` | → `ukol/:assignmentId` (`StudentAssignmentPage`) |
| `/library/student-wall` | `StudentWallLayout` | → **`nastenka`** (`StudentWallPage`) |
| `/library/student/:studentId` | `StudentProfilePage` | **Pohled učitele** — pod knihovnou/třídou, ne pod `/student` |
| `/library/student-wall/folder/:folderId` | `SharedFolderView` | Sdílená složka od učitele |
| `/join/:sessionId` | `JoinSession` | Veřejné vstupy mimo StudentShell |

Další V40: `LiveSessionNotification`, `FirebaseStudentView` (legacy Firebase classroom), kvízové cesty s `viewMode=student`.

---

## 4. Autentizace žáka

### Ultra (cíl)

- **`StudentAuthProvider`**: `frontend/src/app/contexts/StudentAuthContext.tsx`
- Drží `user`, `session` (Supabase) a **`student: StudentProfile | null`**
- Role: tabulka **`profiles`** (`user_type`) + data studenta (**`public.students`**); při chybě tabulky degradace (viz kontext)
- Dev: `student-dev-auth` / `getStudentDevProfile()`
- **Integrace modulu:** vždy **`useStudentAuth()`**, ne paralelní auth bez refaktoru

### Vividbooks40 (zdroj)

- **`src/contexts/StudentAuthContext.tsx`** — načítání přes REST `students?auth_id=eq.{authId}`, Bearer session token + `apikey`; join na `classes` / `schools`
- Typ **`StudentProfile`**: `id`, `name`, `email`, `initials`, `color`, `class_id`, `class_name`, `school_id`, `school_name`, `auth_id`, `avatar`, …
- Akce: `login`, `logout`, `setupPassword`, `refreshStudent`, `updateAvatar`, online status (`students.is_online`)
- **`ViewModeContext`** synchronizuje demo/`vividbooks_student_profile` s reálným žákem

**Migrace:** sjednotit tvar `StudentProfile` s Ultra; ověřit RLS na `students` / `profiles`; přenést logiku online status a avatara jen pokud Ultra schéma odpovídá.

---

## 5. API hranice (kritické)

### Ultra

1. **Legacy Vividbooks API** (knihovna) — `teacher-library`, `vividbooksApi.ts`, Edge env `LEGACY_VIVIDBOOKS_API_BASE`
2. **Supabase** — klient `frontend/src/app/utils/client.ts`, RLS
3. **Edge Function** `supabase/functions/api/index.ts` — Hono, `requireJwtAuth`, role učitele ve `_shared/`
4. Lokální **`/api`** — Vite proxy na `backend/`; nové funkce preferovat Supabase/Edge

### V40 (co modul žáka dnes používá)

- **Přímé Supabase JS** z `src/utils/supabase/client.ts`
- **REST** z kontextu žáka (stejný projekt co Ultra cílí)
- **`utils/student-assignments.ts`** — localStorage + insert do `student_assignments` / `student_submissions`
- **`utils/student-content-sync.ts`** — obsah žáka, sync do cloudu (feature tabulka `student_content` v novějších větvích — viz `features/moje-trida`)
- **`utils/supabase/classes.ts`** — učitelský pohled (`getStudents`, `getResults`, …) pro `StudentProfilePage`
- **Firebase** — část sdílení / `FirebaseStudentView`, Realtime v `StudentContentLayout` importech

**Pravidlo při portu:** mapovat V40 localStorage klíče na Ultra Supabase; knihovní katalog nemíchat do obecných dotazů bez záměru.

---

## 6. Studentské obrazovky — Ultra vs V40

### Ultra (`router.tsx`, větev `StudentShell`)

| Oblast | Komponenta (Ultra) |
|--------|---------------------|
| přesměrování `/student` | → typicky pracovna |
| `pracovna` | `StudentContentPage` |
| `knihovna`, `dokumenty` | `StudentLibraryPage` |
| `nastenka` | `StudentWallPage` |
| `zpravy` | sdílená stránka zpráv |
| `ukol/:assignmentId` | `StudentAssignmentPage` |

Úkoly: `app/utils/student-assignments.ts`, typy `app/types/student-assignment.ts`.  
Obsah žáka: `features/.../student-content-repository.ts` (tabulka `student_content`).

### V40 — přímočaré mapování

| Ultra koncept | V40 soubor(y) |
|---------------|----------------|
| Pracovna / vlastní obsah | `StudentContentLayout.tsx`, `student-content-sync.ts` |
| Nástěnka | `StudentWallLayout.tsx` (úkoly, výsledky, evaluace, zprávy, sdílené složky) |
| Úkol | `StudentAssignmentEditor.tsx`, `student-assignments.ts` |
| Dashboard (slabý) | `StudentDashboard.tsx` — v Ultra zvážit sloučení nebo nahrazení |
| Dokument v úkolu / úpravy | `StudentDocumentEditor.tsx`, `MyContentEditor.tsx` s `?studentMode` |
| Profil u učitele | `StudentProfilePage.tsx` + `classes.ts` |

---

## 7. Navigace a shell UI (Ultra)

- **`StudentShell`**: sidebar, `SidebarProvider`, režimy z `sidebar/types.ts` (`student-library`, `student-workspace`, `student-messages`, `student-wall`)
- Nová sekce (např. dedikovaný profil): **route v `router.tsx`** + položky v sidebaru
- **`PageLayout`** + `headerView`

**V40:** vlastní hlavičky v každé velké komponentě (`ToolsMenu`, logo); při portu sjednotit na Ultra shell + `PageLayout`.

---

## 8. Feature moduly (Ultra)

- **`features/moje-trida/`** — primárně učitel; žák může konzumovat data přes API / RLS.

**V40 doplnění:** `src/features/moje-trida/repositories/student-content-repository.ts` (pokud je ve větvi) — zarovnat s Ultra `student_content`.

Nový izolovaný studentský kód v Ultra: `app/pages/student/` + služby, nebo `src/features/<name>/`.

---

## 9. Prostředí a příkazy (Ultra)

```bash
npm run dev --workspace=frontend
npm run build --workspace=frontend
```

Port dev serveru často **3002** (viz Ultra `vite.config.ts`).  
Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, Edge secrets.

**V40:** root `npm run dev` / `npm run build`; env `VITE_*` v root `.env`.

---

## 10. Checklist integrace modulu (Ultra + odkud vzít ve V40)

1. **URL:** Ultra `/student/...`, `APP_ROUTE_SEGMENTS`, `canonicalizeAppPathname` — V40 routy viz sekce 3.
2. **Auth:** `useStudentAuth()` — zdroj: `StudentAuthContext.tsx` (V40).
3. **Data:** knihovna → pipeline Ultra; úkoly/obsah → `student-assignments.ts`, `student-content-sync.ts` + DB schéma; učitelský pohled na žáka → `StudentProfilePage` + `classes.ts`.
4. **Výsledky / hodnocení:** Ultra `SESSION_RESULTS_INTEGRATION_SPEC.md`; V40 související: `QuizResultsPage`, `ClassResultsGrid`, `utils/student-assignments.ts` (`text_preview`), dokumentace `docs/QUIZ-RESULTS-INTEGRATION-HANDOFF.md` z V40.
5. **Kód:** v Ultra preferovat anglické identifikátory (`frontend/AGENTS.md`); UI texty cs.
6. **UI:** `PageLayout`, design tokeny Ultra — přepsat z inline stylů V40 kde nutné.
7. **Legacy:** V40 `FirebaseStudentView` — rozhodnout, zda v Ultra nahradit plně Supabase/Realtime nebo ponechat dočasně.

---

## 11. Dokumenty v Ultra (číst v cílovém repu)

- `docs/ARCHITECTURE.md`
- `docs/MONOREPO_STRUCTURE.md`
- `docs/SESSION_RESULTS_INTEGRATION_SPEC.md`
- `docs/LIBRARY_MIGRATION_FROM_VIVIDBOOKS40.md`
- `frontend/AGENTS.md`

## 12. Dokumenty ve Vividbooks40 (zdroj migrace žáka)

| Dokument | Obsah |
|----------|--------|
| Tento soubor | Mapování Ultra ↔ V40 pro žákovský modul |
| `docs/PORTING-MOJE-TRIDA.md` | Moje třída / Supabase |
| `docs/QUIZ-RESULTS-INTEGRATION-HANDOFF.md` | Agregace výsledků, typy view-modelu |

---

*Dokument slouží jako podklad pro přenos studentského profilu, dashboardu, pracovny, nástěnky a úkolů z Vividbooks40 do VividBooks Ultra. Při rozporu cest nebo schématu má pravdu cílový repozitář `vividbooks-ultra`.*
